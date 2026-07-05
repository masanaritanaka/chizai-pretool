import { useEffect, useRef, useState } from 'react';
import { BackButton } from '../../components/BackButton';
import { DisclaimerBanner, DISCLAIMER_TEXT } from '../../components/DisclaimerBanner';
import { LoadingBar } from '../../components/LoadingBar';
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
  特許: '#2563EB', 商標: '#7C3AED', 意匠: '#DB2777',
  実用新案: '#059669', 契約: '#D97706',
};

const INPUT_PLACEHOLDER: Record<number, string> = {
  1: '商標にしたい社名・商品名を入力してください。\n業種や商品・サービスの概要もあると精度が上がります。\nまたはファイルをドロップして読み込むこともできます。',
  2: '商標候補と、登録したい商品・サービスの概要を入力してください。\nまたはファイルをドロップ。',
  3: '特許文書のテキスト（クレーム・要約・説明文）を貼り付けてください。\nJ-PlatPat からコピーするか、PDFをドロップしてください。',
  4: '自社のアイデアや技術的な構想を自由に書いてください。\nメモやドキュメントをドロップしても読み込めます。',
  5: '確認したい意匠やUI画面の画像をドロップしてください。\n補足の説明は画像を選んだ後に入力できます。',
  9: '確認したい契約書や提案書のテキストを貼り付けてください。\nPDF / Word / Excel / 画像ファイルもドロップ対応です。',
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

  // ── ファイル処理 ──────────────────────────────────────────────────────────────

  // handleFile は毎レンダーで再生成されるため ref で最新版を保持（Tauri D&D クロージャの stale 防止）
  const handleFileRef = useRef<(file: File) => Promise<void>>(null as unknown as (file: File) => Promise<void>);

  async function handleFile(file: File) {
    setIngestError(null);

    if (!isAcceptedFile(file)) {
      setIngestError(`対応していないファイル形式です（${file.name}）。対応: txt / md / html / pdf / docx / xlsx / jpg / png / gif / webp`);
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
        setState({ status: 'ocr', fileName: file.name });
        try {
          const ocrText = await callClaudeOcr(result.base64, result.mediaType as ImageMediaType);
          setTextInput(prev =>
            prev.trim()
              ? `${prev}\n\n[画像から読み取り: ${file.name}]\n${ocrText}`
              : `[画像から読み取り: ${file.name}]\n${ocrText}`,
          );
          setState({ status: 'idle' });
        } catch (e) {
          setState({ status: 'idle' });
          if (isClaudeError(e)) setIngestError(e.message);
          else setIngestError('画像の文字読み取りに失敗しました。テキストを直接貼り付けてください。');
        }
      } else {
        setState({ status: 'idle' });
        setIngestError('このメニューは画像入力に対応していません。テキストファイルを使用してください。');
      }
      return;
    }

    setTextInput(prev =>
      prev.trim()
        ? `${prev}\n\n[${file.name}]\n${result.text}`
        : result.text,
    );
    setState({ status: 'idle' });
  }

  // handleFile ref を毎レンダー後に最新に更新
  useEffect(() => {
    handleFileRef.current = handleFile;
  });

  // ── Tauri Finder D&D ──────────────────────────────────────────────────────────

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

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
          const bytes = await invoke<number[]>('read_dropped_file', { path });
          const uint8 = new Uint8Array(bytes);
          const blob = new Blob([uint8]);
          const file = new File([blob], filename);
          await handleFileRef.current(file);
        } catch (e) {
          setIngestError(`ファイルの読み込みに失敗しました: ${String(e).slice(0, 120)}`);
        }
      }
    }).then(fn => {
      // cancelled が true なら既にアンマウント済み → 即解除
      if (cancelled) fn(); else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  // preset.id が変わった時だけ再登録
  }, [preset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Web D&D ──────────────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true); }
  function onDragLeave() { setIsDragOver(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── 送信 ──────────────────────────────────────────────────────────────────────

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
    if (state.status === 'extracting') return 'ファイルを読み込み中…';
    if (state.status === 'ocr') return '画像を読み取り中…';
    if (state.status === 'calling') return 'AIが分析中…';
    return '分析する';
  }

  function loadingBarLabel() {
    if (state.status === 'extracting') return `ファイルを読み込み中… (${state.fileName})`;
    if (state.status === 'ocr') return `画像から文字を読み取り中… (${state.fileName})`;
    return 'AIが分析しています。少々お待ちください…';
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

        {isVisionPreset && visionImage && (
          <div className="vision-preview-wrap">
            <img src={visionImage.previewUrl} alt="アップロード画像" className="vision-preview-img" />
            <button type="button" className="vision-preview-remove" onClick={() => { setVisionImage(null); setVisionDesc(''); }}>
              ✕ 画像を変更
            </button>
          </div>
        )}

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
                ここにドロップしてください
              </div>
            )}
          </div>
        )}

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
              <p>画像をドラッグ&ドロップ、またはクリックして選択</p>
              <p className="image-drop-zone__hint">JPEG / PNG / GIF / WebP ・5MB 以下</p>
            </div>
          </div>
        )}

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
            <span className="file-upload-hint">txt / pdf / Word / Excel / 画像</span>
          </label>
          {ingestError && <span className="upload-error">{ingestError}</span>}
        </div>

        <button
          type="submit"
          className={`research-page__submit${isBusy ? ' research-page__submit--busy' : ''}`}
          disabled={!canSubmit}
          style={{ '--cluster-color': color } as React.CSSProperties}
        >
          {isBusy && <span className="btn-spinner" style={{ borderTopColor: '#fff' }} />}
          {busyLabel()}
        </button>
      </form>

      {/* ローディングバー */}
      {isBusy && (
        <LoadingBar label={loadingBarLabel()} color={color} />
      )}

      {/* エラー */}
      {state.status === 'error' && (
        <div className={`research-error research-error--${state.errorType}`}>
          <strong>
            {state.errorType === 'no_key'     && '⚠ APIキーが設定されていません'}
            {state.errorType === 'network'    && '⚠ 接続エラーが発生しました'}
            {state.errorType === 'auth'       && '⚠ APIキーが正しくありません'}
            {state.errorType === 'billing'    && '⚠ 利用残高が不足しています'}
            {state.errorType === 'rate_limit' && '⚠ リクエスト数の上限に達しました'}
            {state.errorType === 'api_error'  && '⚠ AI応答エラーが発生しました'}
            {state.errorType === 'unknown'    && '⚠ エラーが発生しました'}
          </strong>
          <p>{state.message}</p>
          {state.errorType === 'billing' && (
            <p className="research-error__action">
              console.anthropic.com にログインし、Billing から残高を追加すると再開できます。
            </p>
          )}
        </div>
      )}

      {/* 生テキストフォールバック */}
      {state.status === 'done' && state.rawText && (
        <div className="research-card">
          <h2 className="research-card__heading">分析結果</h2>
          <pre className="research-raw">{state.rawText}</pre>
        </div>
      )}

      {/* 調査メモ */}
      {state.status === 'done' && !state.rawText && (
        <>
          <div className="research-card">
            <h2 className="research-card__heading" style={{ color }}>調査メモ</h2>
            <dl className="memo-dl">
              <dt>{labels.technicalField}</dt><dd>{state.memo.technicalField}</dd>
              <dt>{labels.problem}</dt><dd>{state.memo.problem}</dd>
              <dt>{labels.solution}</dt><dd>{state.memo.solution}</dd>
              {state.memo.components.length > 0 && (<>
                <dt>主な構成要素</dt>
                <dd><ul className="memo-list">{state.memo.components.map((c, i) => <li key={i}>{c}</li>)}</ul></dd>
              </>)}
              {state.memo.synonymsAndEnglish.length > 0 && (<>
                <dt>関連キーワード・英語表現</dt>
                <dd><div className="memo-tags">{state.memo.synonymsAndEnglish.map((s, i) => <span key={i} className="memo-tag">{s}</span>)}</div></dd>
              </>)}
            </dl>
            <div className="memo-risk">
              <strong>リスク判定</strong>
              <p>{state.memo.riskAssessment}</p>
            </div>
            {state.memo.expertQuestions.length > 0 && (
              <div className="memo-expert">
                <strong>弁理士に確認すべきポイント</strong>
                <ol>{state.memo.expertQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol>
              </div>
            )}
          </div>

          {jplatpatLinks.length > 0 && (
            <div className="research-card">
              <h2 className="research-card__heading" style={{ color }}>特許庁サイトで検索する</h2>
              <p className="jplatpat-hint">下のキーワードをコピーして、特許庁の無料検索サイト（J-PlatPat）に貼り付けてください。</p>
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
                    特許庁の無料サイトを開く →
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
