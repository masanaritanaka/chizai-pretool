import { useRef, useState } from 'react';
import { BackButton } from '../../components/BackButton';
import { DisclaimerBanner, DISCLAIMER_TEXT } from '../../components/DisclaimerBanner';
import { clusterColor } from '../../home/presets';
import type { ImageMediaType } from '../../lib/claude';
import { callClaude, callClaudeVision, isClaudeError } from '../../lib/claude';
import { extractTextFromFile } from '../../lib/fileExtract';
import { buildLinks, openJplatpat } from '../../lib/jplatpat';
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

const ACCEPTED_IMAGE_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_DOC_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv', '.text'];

interface ImageData { base64: string; mediaType: ImageMediaType; previewUrl: string; fileName: string }

interface Props {
  preset: Preset;
  onBack: () => void;
}

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; errorType: string }
  | { status: 'done'; memo: StructuredMemo; rawText?: string };

const INPUT_PLACEHOLDER: Record<number, string> = {
  1: '商標候補のネーミングを入力してください。\n業種・商品/役務の概要も書くと精度が上がります。',
  2: '商標候補と、指定したい商品・役務の概要を入力してください。\n既存の類似商標があれば合わせて記載してください。',
  3: 'J-PlatPat から特許文書（クレーム・要約・明細書）のテキストをコピーして貼り付けてください。\n特許番号だけの入力は対応していません（§4 データソース方針）。',
  4: 'アイデアや技術構想を自由に記述してください。\n\n・何を解決したいか\n・どのような仕組みで解決するか\n・既存技術との違い',
  9: '契約書・提案書・仕様書のテキストを貼り付けてください。\nまたはボタンから PDF / DOCX / TXT ファイルを直接読み込めます。',
};

function readFileAsBase64(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mediaType = (header.match(/:(.*?);/)?.[1] ?? 'image/jpeg') as ImageMediaType;
      resolve({ base64, mediaType, previewUrl: result, fileName: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


function emptyMemo(): StructuredMemo {
  return { technicalField: '', problem: '', solution: '', components: [], synonymsAndEnglish: [], riskAssessment: '', expertQuestions: [], searchKeywords: [] };
}

export function ResearchPage({ preset, onBack }: Props) {
  const [input, setInput] = useState('');
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [visionDesc, setVisionDesc] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, setState] = useState<PageState>({ status: 'idle' });
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = FIELD_LABELS[preset.id] ?? FIELD_LABELS[4];
  const color = clusterColor[preset.cluster];
  const isVision = preset.inputType === 'image';
  const hasFileUpload = preset.inputType === 'text-with-file';

  // ── Image drag & drop ───────────────────────────────────────────────────────

  function handleImageFile(file: File) {
    setFileError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as ImageMediaType)) {
      setFileError(`非対応ファイル形式です（JPEG / PNG / GIF / WebP が使えます）。`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('ファイルサイズは 5MB 以下にしてください。');
      return;
    }
    readFileAsBase64(file).then(setImageData).catch(() => setFileError('ファイルの読み込みに失敗しました。'));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }

  // ── Document file upload (preset 09): PDF / DOCX / TXT etc. ─────────────────

  const [fileLoading, setFileLoading] = useState(false);

  async function handleTextFile(file: File) {
    setFileError(null);
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_DOC_EXTENSIONS.includes(ext)) {
      setFileError(`対応ファイル形式: PDF / DOCX / TXT / MD。他の形式はテキストを直接貼り付けてください。`);
      return;
    }
    setFileLoading(true);
    try {
      const result = await extractTextFromFile(file);
      if (result.fallback) {
        setFileError(result.reason ?? 'テキスト抽出に失敗しました。');
      } else {
        setInput(prev => prev ? `${prev}\n\n--- ${file.name} ---\n${result.text}` : result.text);
        setFileError(null);
      }
    } catch (e) {
      setFileError(`読み込みエラー: ${String(e).slice(0, 120)}`);
    } finally {
      setFileLoading(false);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isVision && !imageData) return;
    if (!isVision && !input.trim()) return;

    setState({ status: 'loading' });

    try {
      let raw: string;

      if (isVision && imageData) {
        const system = buildVisionSystemPrompt();
        const text = buildVisionTextMessage(visionDesc);
        raw = await callClaudeVision(system, imageData.base64, imageData.mediaType, text);
      } else {
        const system = buildSystemPrompt(preset);
        const user = buildUserMessage(preset, input);
        raw = await callClaude(system, user);
      }

      let memo: StructuredMemo;
      try {
        memo = JSON.parse(raw) as StructuredMemo;
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        memo = match ? JSON.parse(match[0]) as StructuredMemo : emptyMemo();
        if (!match) { setState({ status: 'done', memo, rawText: raw }); return; }
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

  const jplatpatLinks =
    state.status === 'done' && !state.rawText
      ? buildLinks(preset.lawDomains, state.memo.searchKeywords)
      : [];

  const canSubmit = isVision ? !!imageData : !!input.trim();

  return (
    <div className="research-page">
      {/* ── ヘッダー ── */}
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

      {/* ── 入力フォーム ── */}
      <form className="research-page__form" onSubmit={handleSubmit}>

        {/* Vision: 画像アップロード */}
        {isVision && (
          <div className="image-upload-section">
            <div
              className={`image-drop-zone${isDragOver ? ' image-drop-zone--over' : ''}${imageData ? ' image-drop-zone--has-image' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !imageData && fileInputRef.current?.click()}
            >
              {imageData ? (
                <>
                  <img src={imageData.previewUrl} alt="アップロード画像" className="image-preview" />
                  <div className="image-preview__overlay">
                    <button type="button" className="image-preview__remove" onClick={e => { e.stopPropagation(); setImageData(null); }}>
                      ✕ 画像を変更
                    </button>
                  </div>
                </>
              ) : (
                <div className="image-drop-zone__placeholder">
                  <span className="image-drop-zone__icon">🖼</span>
                  <p>画像をドラッグ&ドロップ、またはクリックして選択</p>
                  <p className="image-drop-zone__hint">JPEG / PNG / GIF / WebP ・5MB 以下</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
            {fileError && <p className="upload-error">{fileError}</p>}
            {imageData && (
              <textarea
                className="research-page__textarea research-page__textarea--sm"
                value={visionDesc}
                onChange={e => setVisionDesc(e.target.value)}
                placeholder="補足情報（物品の用途・ターゲット市場・デザインコンセプトなど。省略可）"
                rows={3}
                disabled={state.status === 'loading'}
              />
            )}
          </div>
        )}

        {/* テキスト入力（Vision以外） */}
        {!isVision && (
          <div className="text-input-section">
            <textarea
              className="research-page__textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={INPUT_PLACEHOLDER[preset.id] ?? ''}
              rows={8}
              disabled={state.status === 'loading'}
            />
            {/* ファイル読み込みボタン（preset 09） */}
            {hasFileUpload && (
              <div className="file-upload-row">
                <input
                  type="file"
                  id="text-file-input"
                  accept=".pdf,.docx,.txt,.md,.csv,.text"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleTextFile(f); e.target.value = ''; }}
                />
                <label htmlFor="text-file-input" className={`file-upload-btn${fileLoading ? ' file-upload-btn--loading' : ''}`}>
                  {fileLoading ? '⏳ 抽出中…' : '📄 ファイルから読み込む (PDF / DOCX / TXT)'}
                </label>
                {fileError && <span className="upload-error">{fileError}</span>}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="research-page__submit"
          disabled={!canSubmit || state.status === 'loading'}
          style={{ '--cluster-color': color } as React.CSSProperties}
        >
          {state.status === 'loading' ? '分析中…' : '分析する'}
        </button>
      </form>

      {/* ── エラー ── */}
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

      {/* ── 生テキストフォールバック ── */}
      {state.status === 'done' && state.rawText && (
        <div className="research-card">
          <h2 className="research-card__heading">分析結果（テキスト）</h2>
          <pre className="research-raw">{state.rawText}</pre>
        </div>
      )}

      {/* ── 構造化メモ ── */}
      {state.status === 'done' && !state.rawText && (
        <>
          <div className="research-card">
            <h2 className="research-card__heading" style={{ color }}>構造化メモ</h2>
            <dl className="memo-dl">
              <dt>{labels.technicalField}</dt><dd>{state.memo.technicalField}</dd>
              <dt>{labels.problem}</dt><dd>{state.memo.problem}</dd>
              <dt>{labels.solution}</dt><dd>{state.memo.solution}</dd>
              {state.memo.components.length > 0 && (<>
                <dt>構成要素・チェック項目</dt>
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

          {/* J-PlatPat 検索 */}
          {jplatpatLinks.length > 0 && (
            <div className="research-card">
              <h2 className="research-card__heading" style={{ color }}>J-PlatPat 検索</h2>
              <p className="jplatpat-hint">下の検索式をコピーして J-PlatPat の式入力検索欄に貼り付けてください。</p>
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
