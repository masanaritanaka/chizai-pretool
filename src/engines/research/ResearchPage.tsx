import { useEffect, useRef, useState } from 'react';
import { BackButton } from '../../components/BackButton';
import { DisclaimerBanner, DISCLAIMER_TEXT } from '../../components/DisclaimerBanner';
import { LoadingBar } from '../../components/LoadingBar';
import type { ImageMediaType } from '../../lib/claude';
import { callClaude, callClaudeOcr, callClaudeVision, isClaudeError } from '../../lib/claude';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ACCEPT_ATTR, type ImageResult, type IngestResult, ingestFile, isAcceptedFile } from '../../lib/fileIngest';
import { buildLinks, getGroupLines, openJplatpat, type KeywordGroup } from '../../lib/jplatpat';
import { clusterColor } from '../../home/presets';
import type { Preset } from '../../home/presets';
import {
  buildSystemPrompt, buildUserMessage,
  buildVisionSystemPrompt, buildVisionTextMessage,
} from './prompts';
import {
  FIELD_LABELS,
  type ContractRiskMemo,
  type DesignSimilarityMemo,
  type PatentReadMemo,
  type PreFilingCheckMemo,
  type StructuredMemo,
  type TrademarkNamingMemo,
} from './types';

const LAW_DOMAIN_COLORS: Record<string, string> = {
  特許: '#2563EB', 商標: '#7C3AED', 意匠: '#DB2777',
  実用新案: '#059669', 契約: '#D97706',
};

const INPUT_PLACEHOLDER: Record<number, string> = {
  1: '商標にしたい社名・商品名を入力してください。\n業種や商品・サービスの概要もあると精度が上がります。\nまたはファイルをドロップして読み込むこともできます。',
  2: '商標候補と、登録したい商品・サービスの概要を入力してください。\nまたはファイルをドロップ。',
  3: '特許文書のテキスト（保護範囲の記述・要約・説明文）を貼り付けてください。\nJ-PlatPat からコピーするか、PDFをドロップしてください。\n図面・図表が含まれる画像もドロップで読み込めます。',
  4: '自社のアイデアや技術的な構想を自由に書いてください。\nメモやドキュメントをドロップしても読み込めます。',
  5: '確認したい意匠やUI画面の画像をドロップしてください。\n補足の説明は画像を選んだ後に入力できます。',
  9: '確認したい契約書や提案書のテキストを貼り付けてください。\nPDF / Word / Excel / 画像ファイルもドロップ対応です。',
};

function emptyMemo(): StructuredMemo {
  return { technicalField: '', problem: '', solution: '', components: [], synonymsAndEnglish: [], riskAssessment: '', expertQuestions: [], keyword_groups: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 共通サブコンポーネント
// ─────────────────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="patent-read-section">
      <div className="patent-read-section__label">{label}</div>
      <div className="patent-read-section__body">{children}</div>
    </div>
  );
}

function JplatpatSection({ color, links, groups, copied, onCopy }: {
  color: string;
  links: ReturnType<typeof buildLinks>;
  groups: KeywordGroup[];
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  if (links.length === 0) return null;
  const groupLines = getGroupLines(groups);

  return (
    <div className="research-card">
      <h2 className="research-card__heading" style={{ color }}>特許庁サイトで検索する</h2>
      {links.map(link => (
        <div key={link.domain} className="jplatpat-block">
          <div className="jplatpat-block__label">{link.label}</div>

          {link.expressionType === 'formula' ? (
            <>
              <p className="jplatpat-hint">
                論理式入力タブに貼り付けてください。選択入力を使う場合は下の表の各行を1つのキーワード欄に貼り付けます。
              </p>
              {/* モード1: 論理式をコピー */}
              <div className="jplatpat-expression">
                <code className="jplatpat-expression__code">{link.expression || '（キーワードなし）'}</code>
                {link.expression && (
                  <button type="button" className="copy-btn" onClick={() => onCopy(link.expression, `expr-${link.domain}`)}>
                    {copied === `expr-${link.domain}` ? '論理式コピー済 ✓' : '論理式をコピー'}
                  </button>
                )}
              </div>
              {/* モード2: グループ別コピー（選択入力向け） */}
              {groupLines.length > 0 && (
                <div className="jplatpat-group-lines">
                  <div className="jplatpat-group-lines__head">選択入力用（各行 = キーワード欄1つ）</div>
                  {groupLines.map((g, i) => (
                    <div key={i} className="jplatpat-group-line">
                      <span className="jplatpat-group-line__element">{g.element}</span>
                      <code className="jplatpat-group-line__terms">{g.terms}</code>
                      <button
                        type="button" className="copy-btn copy-btn--sm"
                        onClick={() => onCopy(g.terms, `line-${link.domain}-${i}`)}
                      >
                        {copied === `line-${link.domain}-${i}` ? '✓' : 'コピー'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* 商標: 選択入力モード（フィールドコード未確認のため論理式不使用） */
            <>
              <p className="jplatpat-hint">
                商標テキスト検索の「選択入力」タブを開き、キーワード欄に貼り付けてください。
                <br />
                <span className="jplatpat-hint--sub">（商標検索のフィールドコードは仕様未確認のため、論理式入力には対応していません）</span>
              </p>
              <div className="jplatpat-expression">
                <code className="jplatpat-expression__code">{link.expression || '（キーワードなし）'}</code>
                {link.expression && (
                  <button type="button" className="copy-btn" onClick={() => onCopy(link.expression, `expr-${link.domain}`)}>
                    {copied === `expr-${link.domain}` ? 'コピー済 ✓' : 'キーワードをコピー'}
                  </button>
                )}
              </div>
            </>
          )}

          <button
            type="button" className="jplatpat-open-btn"
            style={{ '--cluster-color': color } as React.CSSProperties}
            onClick={() => openJplatpat(link.url)}
          >
            特許庁の無料サイトを開く →
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset 01 — 商標ネーミング危険度チェッカー
// ─────────────────────────────────────────────────────────────────────────────

function TrademarkNamingCard({ memo, color, copied, onCopy }: {
  memo: TrademarkNamingMemo; color: string; copied: string | null; onCopy: (t: string, k: string) => void;
}) {
  const links = buildLinks(['商標'], memo.keyword_groups ?? []);
  const riskClass = memo.riskLevel?.startsWith('高') ? 'risk-high'
    : memo.riskLevel?.startsWith('中') ? 'risk-mid'
    : 'risk-low';

  return (
    <>
      <div className="research-card">
        <h2 className="research-card__heading" style={{ color }}>商標ネーミング診断</h2>
        <Section label="称呼・外観・観念の分析">{memo.phoneticsAnalysis}</Section>
        <Section label="既登録商標との類似リスク">{memo.conflictRisk}</Section>
        <div className={`trademark-risk-level trademark-risk-level--${riskClass}`}>
          <span className="trademark-risk-level__icon">
            {riskClass === 'risk-high' ? '🔴' : riskClass === 'risk-mid' ? '🟡' : '🟢'}
          </span>
          <span>{memo.riskLevel}</span>
        </div>
        {memo.preFilingActions && memo.preFilingActions.length > 0 && (
          <Section label="出願前に確認すべきアクション">
            <ol className="patent-read-list">
              {memo.preFilingActions.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          </Section>
        )}
        <div className="research-disclaimer">{DISCLAIMER_TEXT}</div>
      </div>
      <JplatpatSection color={color} links={links} groups={memo.keyword_groups ?? []} copied={copied} onCopy={onCopy} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset 02 — 商標出願前チェックリスト
// ─────────────────────────────────────────────────────────────────────────────

function PreFilingCheckCard({ memo, color, copied, onCopy }: {
  memo: PreFilingCheckMemo; color: string; copied: string | null; onCopy: (t: string, k: string) => void;
}) {
  const links = buildLinks(['商標'], memo.keyword_groups ?? []);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  return (
    <>
      <div className="research-card">
        <h2 className="research-card__heading" style={{ color }}>商標出願前チェックリスト</h2>
        <Section label="ニース国際分類（候補）">{memo.niceClasses}</Section>
        <Section label="識別力の確認ポイント">{memo.distinctiveness}</Section>
        {memo.checklist && memo.checklist.length > 0 && (
          <div className="patent-read-section">
            <div className="patent-read-section__label">出願前チェックリスト</div>
            <ul className="prefiling-checklist">
              {memo.checklist.map((item, i) => (
                <li key={i} className={`prefiling-checklist__item${checked[i] ? ' prefiling-checklist__item--done' : ''}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!checked[i]}
                      onChange={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Section label="費用・期間の目安">{memo.costEstimate}</Section>
        <div className="research-disclaimer">{DISCLAIMER_TEXT}</div>
      </div>
      <JplatpatSection color={color} links={links} groups={memo.keyword_groups ?? []} copied={copied} onCopy={onCopy} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset 03 — 特許文書をやさしく読み解く
// ─────────────────────────────────────────────────────────────────────────────

function PatentReadCard({ memo, color }: { memo: PatentReadMemo; color: string }) {
  return (
    <div className="research-card">
      <h2 className="research-card__heading" style={{ color }}>読み解き結果</h2>
      <Section label="ひとことで言うと">{memo.summary}</Section>
      <Section label="どんな場面で使われる技術か">{memo.usageScenes}</Section>
      <Section label="従来との違い・新しさ">{memo.novelty}</Section>

      {memo.termMap && memo.termMap.length > 0 && (
        <div className="patent-read-section">
          <div className="patent-read-section__label">本文の要点マップ</div>
          <table className="patent-term-table">
            <thead><tr><th>原文の表現</th><th>わかりやすく言うと</th></tr></thead>
            <tbody>
              {memo.termMap.map((row, i) => (
                <tr key={i}>
                  <td className="patent-term-table__original">{row.term}</td>
                  <td>{row.plain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {memo.businessQuestions && memo.businessQuestions.length > 0 && (
        <Section label="経営判断のための3つの問い">
          <ol className="patent-read-list">
            {memo.businessQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </Section>
      )}

      {memo.whenToConsult && memo.whenToConsult.length > 0 && (
        <div className="memo-expert">
          <strong>弁理士・専門家に相談すべきタイミング</strong>
          <ol>{memo.whenToConsult.map((item, i) => <li key={i}>{item}</li>)}</ol>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset 05 — 意匠・UI類似チェック
// ─────────────────────────────────────────────────────────────────────────────

function DesignSimilarityCard({ memo, color, copied, onCopy }: {
  memo: DesignSimilarityMemo; color: string; copied: string | null; onCopy: (t: string, k: string) => void;
}) {
  const links = buildLinks(['意匠'], memo.keyword_groups ?? []);
  return (
    <>
      <div className="research-card">
        <h2 className="research-card__heading" style={{ color }}>意匠類似チェック結果</h2>
        <Section label="視覚的特徴の分解（形状・模様・色彩）">{memo.visualFeatures}</Section>
        <Section label="類似判断の要部">{memo.keyElements}</Section>
        <Section label="物品の類否">{memo.articleSimilarity}</Section>
        {memo.priorDesignPoints && memo.priorDesignPoints.length > 0 && (
          <Section label="先行意匠検索の着眼点">
            <ol className="patent-read-list">
              {memo.priorDesignPoints.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </Section>
        )}
        <div className="research-disclaimer">{DISCLAIMER_TEXT}</div>
      </div>
      <JplatpatSection color={color} links={links} groups={memo.keyword_groups ?? []} copied={copied} onCopy={onCopy} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset 09 — 契約・提案書の知財リスクチェッカー（J-PlatPat 検索式なし）
// ─────────────────────────────────────────────────────────────────────────────

function ContractRiskCard({ memo, color }: { memo: ContractRiskMemo; color: string }) {
  return (
    <div className="research-card">
      <h2 className="research-card__heading" style={{ color }}>知財リスクチェック結果</h2>

      {memo.clauses && memo.clauses.length > 0 && (
        <div className="patent-read-section">
          <div className="patent-read-section__label">知財関連条項の抽出</div>
          <div className="contract-clauses">
            {memo.clauses.map((c, i) => (
              <div key={i} className="contract-clause">
                <div className="contract-clause__header">
                  <span className="contract-clause__name">{c.clause}</span>
                  <span className="contract-clause__location">{c.location}</span>
                </div>
                <p className="contract-clause__risk">{c.risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {memo.negotiationOptions && memo.negotiationOptions.length > 0 && (
        <Section label="修正交渉の選択肢">
          <ol className="patent-read-list">
            {memo.negotiationOptions.map((o, i) => <li key={i}>{o}</li>)}
          </ol>
        </Section>
      )}

      {memo.consultationItems && memo.consultationItems.length > 0 && (
        <div className="memo-expert">
          <strong>弁理士・弁護士に相談すべき事項</strong>
          <ol>{memo.consultationItems.map((item, i) => <li key={i}>{item}</li>)}</ol>
        </div>
      )}

      <div className="research-disclaimer">{DISCLAIMER_TEXT}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props / State
// ─────────────────────────────────────────────────────────────────────────────

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
  | { status: 'done'; memo: StructuredMemo; rawText?: string }
  | { status: 'done_p01'; memo: TrademarkNamingMemo }
  | { status: 'done_p02'; memo: PreFilingCheckMemo }
  | { status: 'done_p03'; memo: PatentReadMemo }
  | { status: 'done_p05'; memo: DesignSimilarityMemo }
  | { status: 'done_p09'; memo: ContractRiskMemo };

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

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

  useEffect(() => { handleFileRef.current = handleFile; });

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
      if (cancelled) fn(); else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
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

      const parseJson = <T,>(text: string): T => {
        try { return JSON.parse(text) as T; }
        catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) return JSON.parse(m[0]) as T;
          throw new Error('JSON not found');
        }
      };

      if (preset.id === 1) {
        setState({ status: 'done_p01', memo: parseJson<TrademarkNamingMemo>(raw) });
      } else if (preset.id === 2) {
        setState({ status: 'done_p02', memo: parseJson<PreFilingCheckMemo>(raw) });
      } else if (preset.id === 3) {
        setState({ status: 'done_p03', memo: parseJson<PatentReadMemo>(raw) });
      } else if (preset.id === 5) {
        setState({ status: 'done_p05', memo: parseJson<DesignSimilarityMemo>(raw) });
      } else if (preset.id === 9) {
        setState({ status: 'done_p09', memo: parseJson<ContractRiskMemo>(raw) });
      } else {
        // generic fallback (preset 07, 08, etc.)
        try {
          setState({ status: 'done', memo: parseJson<StructuredMemo>(raw) });
        } catch {
          setState({ status: 'done', memo: emptyMemo(), rawText: raw });
        }
      }
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

  // generic-fallback の J-PlatPat リンク
  const genericJplatpatLinks =
    state.status === 'done' && !state.rawText
      ? buildLinks(preset.lawDomains, state.memo.keyword_groups ?? [])
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
      {isBusy && <LoadingBar label={loadingBarLabel()} color={color} />}

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

      {/* ── Preset 01 ── */}
      {state.status === 'done_p01' && (
        <TrademarkNamingCard memo={state.memo} color={color} copied={copied} onCopy={copyToClipboard} />
      )}

      {/* ── Preset 02 ── */}
      {state.status === 'done_p02' && (
        <PreFilingCheckCard memo={state.memo} color={color} copied={copied} onCopy={copyToClipboard} />
      )}

      {/* ── Preset 03 ── */}
      {state.status === 'done_p03' && (
        <>
          <PatentReadCard memo={state.memo} color={color} />
          <div className="research-disclaimer">{DISCLAIMER_TEXT}</div>
        </>
      )}

      {/* ── Preset 05 ── */}
      {state.status === 'done_p05' && (
        <DesignSimilarityCard memo={state.memo} color={color} copied={copied} onCopy={copyToClipboard} />
      )}

      {/* ── Preset 09 ── */}
      {state.status === 'done_p09' && (
        <ContractRiskCard memo={state.memo} color={color} />
      )}

      {/* ── Generic（preset 03 以外・fallback） ── */}
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

          {genericJplatpatLinks.length > 0 && (
            <JplatpatSection color={color} links={genericJplatpatLinks} groups={state.memo.keyword_groups ?? []} copied={copied} onCopy={copyToClipboard} />
          )}

          <div className="research-disclaimer">{DISCLAIMER_TEXT}</div>
        </>
      )}

      <DisclaimerBanner />
    </div>
  );
}
