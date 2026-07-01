import { useState } from 'react';
import { DisclaimerBanner, DISCLAIMER_TEXT } from '../../components/DisclaimerBanner';
import { clusterColor } from '../../home/presets';
import type { Preset } from '../../home/presets';
import { isClaudeError, callClaude } from '../../lib/claude';
import { buildLinks, openJplatpat } from '../../lib/jplatpat';
import { buildSystemPrompt, buildUserMessage } from './prompts';
import { FIELD_LABELS, type StructuredMemo } from './types';

const LAW_DOMAIN_COLORS: Record<string, string> = {
  特許: '#2563EB',
  商標: '#7C3AED',
  意匠: '#DB2777',
  実用新案: '#059669',
  契約: '#D97706',
};

interface ResearchPageProps {
  preset: Preset;
  onBack: () => void;
}

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; errorType: string }
  | { status: 'done'; memo: StructuredMemo; rawText?: string };

const INPUT_PLACEHOLDER: Record<number, string> = {
  1: '商標候補のネーミングを入力してください（例: クライアント社名・商品名・サービス名）\n\n業種や指定したい商品・役務の概要も一緒に書くと精度が上がります。',
  3: 'J-PlatPat から特許文書（クレーム・要約・明細書）のテキストをコピーして貼り付けてください。\n特許番号だけの入力には対応していません（§4 データソース方針）。',
  4: 'アイデアや技術構想を自由に記述してください。\n\n・何を解決したいのか\n・どのような仕組みで解決するか\n・既存技術との違い（あれば）',
};

export function ResearchPage({ preset, onBack }: ResearchPageProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<PageState>({ status: 'idle' });
  const [copied, setCopied] = useState<string | null>(null);

  const labels = FIELD_LABELS[preset.id] ?? FIELD_LABELS[4];
  const color = clusterColor[preset.cluster];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setState({ status: 'loading' });

    try {
      const system = buildSystemPrompt(preset);
      const user = buildUserMessage(preset, input);
      const raw = await callClaude(system, user);

      let memo: StructuredMemo;
      try {
        memo = JSON.parse(raw) as StructuredMemo;
      } catch {
        // JSON extraction fallback
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          memo = JSON.parse(match[0]) as StructuredMemo;
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
        setState({
          status: 'error',
          message: '予期しないエラーが発生しました。',
          errorType: 'unknown',
        });
      }
    }
  }

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const jplatpatLinks =
    state.status === 'done'
      ? buildLinks(preset.lawDomains, state.memo.searchKeywords)
      : [];

  return (
    <div className="research-page">
      {/* ── ヘッダー ── */}
      <div className="research-page__header">
        <button type="button" className="research-page__back" onClick={onBack}>
          ← ホーム
        </button>
        <div className="research-page__meta">
          <span
            className="research-page__cluster-badge"
            style={{ background: color, color: '#fff' }}
          >
            {preset.cluster}
          </span>
          <h1 className="research-page__title">{preset.label}</h1>
          <div className="research-page__domains">
            {preset.lawDomains.map((d) => (
              <span
                key={d}
                className="law-domain-tag"
                style={{ '--dot-color': LAW_DOMAIN_COLORS[d] ?? '#888' } as React.CSSProperties}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 入力フォーム ── */}
      <form className="research-page__form" onSubmit={handleSubmit}>
        <textarea
          className="research-page__textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={INPUT_PLACEHOLDER[preset.id] ?? ''}
          rows={8}
          disabled={state.status === 'loading'}
        />
        <button
          type="submit"
          className="research-page__submit"
          disabled={!input.trim() || state.status === 'loading'}
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

      {/* ── 結果（生テキストフォールバック） ── */}
      {state.status === 'done' && state.rawText && (
        <div className="research-card">
          <h2 className="research-card__heading">分析結果（テキスト）</h2>
          <pre className="research-raw">{state.rawText}</pre>
        </div>
      )}

      {/* ── 結果（構造化メモ） ── */}
      {state.status === 'done' && !state.rawText && (
        <>
          <div className="research-card">
            <h2 className="research-card__heading" style={{ color }}>構造化メモ</h2>

            <dl className="memo-dl">
              <dt>{labels.technicalField}</dt>
              <dd>{state.memo.technicalField}</dd>

              <dt>{labels.problem}</dt>
              <dd>{state.memo.problem}</dd>

              <dt>{labels.solution}</dt>
              <dd>{state.memo.solution}</dd>

              {state.memo.components.length > 0 && (
                <>
                  <dt>構成要素</dt>
                  <dd>
                    <ul className="memo-list">
                      {state.memo.components.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}

              {state.memo.synonymsAndEnglish.length > 0 && (
                <>
                  <dt>類似語・英語表現</dt>
                  <dd>
                    <div className="memo-tags">
                      {state.memo.synonymsAndEnglish.map((s, i) => (
                        <span key={i} className="memo-tag">{s}</span>
                      ))}
                    </div>
                  </dd>
                </>
              )}
            </dl>

            {/* 危険度所感 */}
            <div className="memo-risk">
              <strong>危険度所感</strong>
              <p>{state.memo.riskAssessment}</p>
            </div>

            {/* 専門家確認事項 */}
            {state.memo.expertQuestions.length > 0 && (
              <div className="memo-expert">
                <strong>専門家に確認すべき論点</strong>
                <ol>
                  {state.memo.expertQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* J-PlatPat 検索 */}
          {jplatpatLinks.length > 0 && (
            <div className="research-card">
              <h2 className="research-card__heading" style={{ color }}>J-PlatPat 検索</h2>
              <p className="jplatpat-hint">
                下の検索式をコピーして J-PlatPat の式入力検索欄に貼り付けてください。
              </p>

              {jplatpatLinks.map((link) => (
                <div key={link.domain} className="jplatpat-block">
                  <div className="jplatpat-block__label">{link.label}</div>
                  <div className="jplatpat-expression">
                    <code>{link.expression || '（キーワードなし）'}</code>
                    {link.expression && (
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyToClipboard(link.expression, link.domain)}
                      >
                        {copied === link.domain ? 'コピー済み ✓' : 'コピー'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="jplatpat-open-btn"
                    style={{ '--cluster-color': color } as React.CSSProperties}
                    onClick={() => openJplatpat(link.url)}
                  >
                    J-PlatPat を開く →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 免責 */}
          <div className="research-disclaimer">
            {DISCLAIMER_TEXT}
          </div>
        </>
      )}

      <DisclaimerBanner />
    </div>
  );
}

function emptyMemo(): StructuredMemo {
  return {
    technicalField: '',
    problem: '',
    solution: '',
    components: [],
    synonymsAndEnglish: [],
    riskAssessment: '',
    expertQuestions: [],
    searchKeywords: [],
  };
}
