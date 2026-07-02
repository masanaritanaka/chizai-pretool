import { useEffect, useRef, useState } from 'react';
import { BackButton } from '../../components/BackButton';
import { DisclaimerBanner, DISCLAIMER_TEXT } from '../../components/DisclaimerBanner';
import type { ImageMediaType } from '../../lib/claude';
import { callClaude, callClaudeOcr, callClaudeVision, isClaudeError } from '../../lib/claude';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ACCEPT_ATTR, type ImageResult, type IngestResult, ingestFile, isAcceptedFile } from '../../lib/fileIngest';
import { buildLinks, openJplatpat } from '../../lib/jplatpat';
import { clusterColor } from '../../home/presets';
import type { Preset } from '../../home/presets';
import {
  buildSystemPrompt, buildUserMessage,
  buildVisionSystemPrompt, buildVisionTextMessage,
} from './prompts';
import { FIELD_LABELS, type StructuredMemo } from './types';

const LAW_DOMAIN_COLORS: Record<string, string> = {
  特許: '#2563EB', 商標: '#7C3AED', 意匠: '#DB2877',
  実用新案: '#059669', 契約: '#D97706',
};

const INPUT_PLACEHOLDER: Record<number, string> = {
  1: '商標候補のネーミングを入力してください。\n業種・商品/役務の概要も書くと精度が上がります。\nまたはファイル（txt/pdf/画像など）をドロップ。',
  2: '商標候補と指定商品・役務の概要を入力してください。\nまたはファイルをドロップ。',
  3: '特許文書テキスト（クレーム・要約・明細書）を貼り付けてください。\nJ-PlatPat からコピーするか PDF をドロップ。',
  4: 'アイデアや技術構想を記述してください。\nまたはメモ・ドキュメントをドロップ。',
  5: '意匠・UIの画像をドロップしてください。\n補足説明があれば画像ドロップ後に入力できます。',
  9: '契約書・提案書のテキストを貼り付けてください。\nPDF / DOCX / XLSX / 画像をドロップ可。',
};

function emptyMemo(): StructuredMemo {
  return { technicalField: '', problem: '', solution: '', components: [], synonymsAndEnglish: [], riskAssessment: '', expertQuestions: [], searchKeywords: [] };
}

interface Props {
  preset: Preset;
  onBack: () => void;
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'extracting'; fileName: string }
  | { status: 'ocr'; fileName: string }
  | { status: 'calling' }
  | { status: 'error'; message: string; errorType: string }
  | { status: 'done'; memo: StructuredMemo; rawText?: string };

export function ResearchPage({ preset, onBack }: Props) {
  const [textInput, setTextInput] = useState('');
  // vision モード用の画像状態
  const [visionImage, setVisionImage] = useState<ImageResult | null>(null);
  const [visionDesc, setVisionDesc] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const color = clusterColor[preset.cluster];
  const labels = FIELD_LABELS[preset.id] ?? FIELD_LABELS[4];
  const isVisionPreset = preset.imageMode === 'vision';

  // ── ファイル処理 ─────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setIngestError(null);

    if (!isAcceptedFile(file)) {
      setIngestError(`非対応形式です（${file.name}）。対応: txt / md / html / pdf / docx / xlsx / jpg / png / gif / webp`);
      return;
    }

    setState({ status: 'extracting', fileName: file.name });
    let result: IngestResult;
    try {
      result = await ingestFile(file);
    } catch (e) {
      setState({ status: 'idle' });
      setIngestError(`読み込みエラー: ${String(e).slice(0, 150)}`);
      return;
    }

    if (result.type === 'error') {
      setState({ status: 'idle' });
      setIngestError(result.reason);
      return;
    }

    if (result.type === 'image') {
      const mode = preset.imageMode;
      if (mode === 'vision') {
        setVisionImage(result);
        setState({ status: 'idle' });
      } else if (mode === 'ocr') {
        // Claude Vision で文字起こし → テキストパイプラインに合流
        setState({ status: 'ocr', fileName: file.name });
        try {
          const ocrText = await callClaudeOcr(result.base64, result.mediaType as ImageMediaType);
          setTextInput(prev =>
            prev.trim()
              ? `${prev}\n\n[画像OCR: ${file.name}]\n${ocrText}`
              : `[画像OCR: ${file.name}]\n${ocrText}`,
          );
          setState({ status: 'idle' });
        } catch (e) {
          setState({ status: 'idle' });
          if (isClaudeError(e)) setIngestError(e.message);
          else setIngestError('OCRに失敗しました。テキストを直接貼り付けてください。');
        }
      } else {
        setState({ status: 'idle' });
        setIngestError('このプリセットは画像入力に対応していません。テキストファイルを使用してください。');
      }
      return;
    }

    // テキスト取り込み
    setTextInput(prev =>
      prev.trim()
        ? `${prev}\n\n[${file.name}]\n${result.text}`
        : result.text,
    );
    setState({ status: 'idle' });
  }

  // ── Tauri Finder D&D（onDragDropEvent 経由） ──────────────────────────────────

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebviewWindow().onDragDropEvent(async (event) => {
      const { type } = event.payload;
      if (type === 'enter' || type === 'over') {
        setIsDragOver(true);
      } else if (type === 'leave') {
        setIsDragOver(false);
      } else if (type === 'drop') {
        setIsDragOver(false);
        const paths: string[] = (event.payload as { paths: string[] }).paths ?? [];
        if (paths.length === 0) return;
        const path = paths[0];
        const filename = path.split('/').pop() || path.split('\\').pop() || path;
        try {
          // Rust コマンド経由でファイルバイト列を取得（scope 制約なし）
          const bytes = await invoke<number[]>('read_dropped_file', { path });
          const uint8 = new Uint8Array(bytes);
          const blob = new Blob([uint8]);
          const file = new File([blob], filename);
          await handleFile(file);
        } catch (e) {
          setIngestError(`Finder からのファイル読み込みエラー: ${String(e).slice(0, 120)}`);
        }
      }
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id]);

  // ── Web D&D（テキストエリア内ドロップ / ブラウザ経由） ─────────────────────────

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true); }
  function onDragLeave() { setIsDragOver(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── 送信 ─────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasText = textInput.trim().length > 0;
    const hasVision = isVisionPreset && visionImage;
    if (!hasText && !hasVision) return;

    setState({ status: 'calling' });
    try {
      let raw: string;

      if (isVisionPreset && visionImage) {
        raw = await callClaudeVision(
          buildVisionSystemPrompt(),
          visionImage.base64,
          visionImage.mediaType as ImageMediaType,
          buildVisionTextMessage(hasText ? textInput : visionDesc),
        );
      } else {
        raw = await callClaude(buildSystemPrompt(preset), buildUserMessage(preset, textInput));
      }

      let memo: StructuredMemo;
      try {
        memo = JSON.parse(raw) as StructuredMemo;
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          memo = JSON.parse(m[0]) as StructuredMemo;
        } else {
          setState({ status: 'done', memo: emptyMemo(), rawText: raw });
          return;
        }
      }
      setState({ status: 'done', memo });
    } catch (err) {
      if (isClaudeError(err)) {
        setState({ status: 'error', message: err.message, errorType: err.errorType });
      } else {
        setState({ status: 'error', message: '予期しないエラーが発生しました。', errorType: 'unknown' });
      }
    }
  }

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const isBusy = state.status === 'extracting' || state.status === 'ocr' || state.status === 'calling';
  const canSubmit = !isBusy && (textInput.trim().length > 0 || (isVisionPreset && !!visionImage));

  const jplatpatLinks =
    state.status === 'done' && !state.rawText
      ? buildLinks(preset.lawDomains, state.memo.searchKeywords)
      : [];

  function busyLabel() {
    if (state.status === 'extracting') return `⏳ 抽出中… (${state.fileName})`;
    if (state.status === 'ocr') return `⏳ 文字起こし中… (${state.fileName})`;
    if (state.status === 'calling') return '⏳ 分析中…';
    return '分析する';
  }

  return (
    <div className="research-page">

      {/* ヘッダー */}
      <div className="page-header">
        <BackButton onClick={onBack} clusterColor={color} />
        <div className="page-header__meta">
          <span className="research-page__cluster-badge" style={{ background: color, color: '#fff' }}>{preset.cluster}</span>
          <h1 className="research-page__title">{preset.label}</h1>
          <div className="research-page__domains">
            {preset.lawDomains.map(d => (
              <span key={d} className="law-domain-tag" style={{ '--dot-color': LAW_DOMAIN_COLORS[d] ?? '#888' } as React.CSSProperties}>{d}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 入力フォーム */}
      <form className="research-page__form" onSubmit={handleSubmit}>

        {/* vision モード: 画像プレビュー */}
        {isVisionPreset && visionImage && (
          <div className="vision-preview-wrap">
            <img src={visionImage.previewUrl} alt="アップロード画像" className="vision-preview-img" />
            <button type="button" className="vision-preview-remove" onClick={() => { setVisionImage(null); setVisionDesc(''); }}>
              ✕ 画像を変更
            </button>
          </div>
        )}

        {/* テキストエリア（全プリセット共通 D&D ゾーン） */}
        {(!isVisionPreset || visionImage) && (
          <div
            className={`textarea-drop-zone${isDragOver ? ' textarea-drop-zone--over' : ''}`}
            style={{ '--cluster-color': color } as React.CSSProperties}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <textarea
              className="research-page__textarea"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={INPUT_PLACEHOLDER[preset.id] ?? 'テキストを入力するか、ファイルをドロップしてください。'}
              rows={isVisionPreset ? 3 : 8}
              disabled={isBusy}
            />
            {isDragOver && (
              <div className="drop-overlay">
                ファイルをドロップ
              </div>
            )}
          </div>
        )}

        {/* vision モードで画像未選択時のドロップゾーン */}
        {isVisionPreset && !visionImage && (
          <div
            className={`image-drop-zone${isDragOver ? ' image-drop-zone--over' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="image-drop-zone__placeholder">
              <span className="image-drop-zone__icon">🖼</span>
              <p>意匠・UI の画像をドラッグ&ドロップ、またはクリックして選択</p>
              <p className="image-drop-zone__hint">JPEG / PNG / GIF / WebP ・5MB 以下</p>
            </div>
          </div>
        )}

        {/* ファイル選択ボタン + エラー */}
        <div className="file-upload-row">
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            accept={ACCEPT_ATTR}
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <label
            htmlFor="file-input"
            className={`file-upload-btn${isBusy ? ' file-upload-btn--loading' : ''}`}
          >
            📄 ファイルを選択
            <span className="file-upload-hint">txt/md/html/pdf/docx/xlsx/画像</span>
          </label>
          {ingestError && <span className="upload-error">{ingestError}</span>}
        </div>

        <button
          type="submit"
          className="research-page__submit"
          disabled={!canSubmit}
          style={{ '--cluster-color': color } as React.CSSProperties}
        >
          {busyLabel()}
        </button>
      </form>

      {/* エラー */}
      {state.status === 'error' && (
        <div className={`research-error research-error--${state.errorType}`}>
          <strong>
            {state.errorType === 'no_key' && '⚠ APIキー未設定'}
            {state.errorType === 'network' && '⚠ ネットワークエラー'}
            {state.errorType === 'rate_limit' && '⚠ レート制限'}
            {state.errorType === 'api_error' && '⚠ APIエラー'}
            {state.errorType === 'unknown' && '⚠ エラー'}
          </strong>
          <p>{state.message}</p>
        </div>
      )}

      {/* 生テキストフォールバック */}
      {state.status === 'done' && state.rawText && (
        <div className="research-card">
          <h2 className="research-card__heading">分析結果</h2>
          <pre className="research-raw">{state.rawText}</pre>
        </div>
      )}

      {/* 構造化メモ */}
      {state.status === 'done' && !state.rawText && (
        <>
          <div className="research-card">
            <h2 className="research-card__heading" style={{ color }}>構造化メモ</h2>
            <dl className="memo-dl">
              <dt>{labels.technicalField}</dt><dd>{state.memo.technicalField}</dd>
              <dt>{labels.problem}</dt><dd>{state.memo.problem}</dd>
              <dt>{labels.solution}</dt><dd>{state.memo.solution}</dd>
              {state.memo.components.length > 0 && (<>
                <dt>構成要素</dt>
                <dd><ul className="memo-list">{state.memo.components.map((c, i) => <li key={i}>{c}</li>)}</ul></dd>
              </>)}
              {state.memo.synonymsAndEnglish.length > 0 && (<>
                <dt>類似語・英語表現</dt>
                <dd><div className="memo-tags">{state.memo.synonymsAndEnglish.map((s, i) => <span key={i} className="memo-tag">{s}</span>)}</div></dd>
              </>)}
            </dl>
            <div className="memo-risk">
              <strong>危険度所感</strong>
              <p>{state.memo.riskAssessment}</p>
            </div>
            {state.memo.expertQuestions.length > 0 && (
              <div className="memo-expert">
                <strong>専門家に確認すべき論点</strong>
                <ol>{state.memo.expertQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol>
              </div>
            )}
          </div>

          {jplatpatLinks.length > 0 && (
            <div className="research-card">
              <h2 className="research-card__heading" style={{ color }}>J-PlatPat 検索</h2>
              <p className="jplatpat-hint">下の検索式をコピーして J-PlatPat の式入力欄に貼り付けてください。</p>
              {jplatpatLinks.map(link => (
                <div key={link.domain} className="jplatpat-block">
                  <div className="jplatpat-block__label">{link.label}</div>
                  <div className="jplatpat-expression">
                    <code>{link.expression || '（キーワードなし）'}</code>
                    {link.expression && (
                      <button type="button" className="copy-btn" onClick={() => copyToClipboard(link.expression, link.domain)}>
                        {copied === link.domain ? 'コピー済み ✓' : 'コピー'}
                      </button>
                    )}
                  </div>
                  <button type="button" className="jplatpat-open-btn" style={{ '--cluster-color': color } as React.CSSProperties} onClick={() => openJplatpat(link.url)}>
                    J-PlatPat を開く →
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="research-disclaimer">{DISCLAIMER_TEXT}</div>
        </>
      )}

      <DisclaimerBanner />
    </div>
  );
}
