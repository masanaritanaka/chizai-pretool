import { useEffect, useState } from 'react';
import { BackButton } from '../../components/BackButton';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { callClaude } from '../../lib/claude';
import { openJplatpat } from '../../lib/jplatpat';
import { createWatchTarget, deleteWatchTarget, listWatchTargets, markChecked } from './db';
import { buildWatchQueryPrompt, buildWatchQueryUserMessage } from './prompts';
import type { WatchLawDomain, WatchTarget, WatchTargetInput } from './types';
import { LAW_DOMAIN_OPTIONS } from './types';

const CLUSTER_COLOR = '#C2740C';

interface ClaudeWatchResult {
  patentExpression: string;
  trademarkExpression: string;
  notes: string;
}

function parseWatchResult(raw: string): ClaudeWatchResult {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj = JSON.parse(cleaned) as Record<string, unknown>;
  return {
    patentExpression: String(obj.patentExpression ?? ''),
    trademarkExpression: String(obj.trademarkExpression ?? ''),
    notes: String(obj.notes ?? ''),
  };
}

function formatDate(dt: string | null): string {
  if (!dt) return '未確認';
  return dt.slice(0, 16).replace('T', ' ');
}

interface Props {
  onBack: () => void;
}

export function CompetitorWatcher({ onBack }: Props) {
  const [targets, setTargets] = useState<WatchTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 入力フォーム
  const [targetName, setTargetName] = useState('');
  const [lawDomain, setLawDomain] = useState<WatchLawDomain>('both');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClaudeWatchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      setTargets(await listWatchTargets());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (!targetName.trim()) return;
    setGenerating(true);
    setGenError(null);
    setPreview(null);
    setSaved(false);
    try {
      const system = buildWatchQueryPrompt(lawDomain);
      const user = buildWatchQueryUserMessage(targetName);
      const raw = await callClaude(system, user);
      setPreview(parseWatchResult(raw));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const input: WatchTargetInput = {
        name: targetName.trim(),
        lawDomain,
        patentExpression: preview.patentExpression || null,
        trademarkExpression: preview.trademarkExpression || null,
        notes: preview.notes || null,
      };
      await createWatchTarget(input);
      setSaved(true);
      setTargetName('');
      setPreview(null);
      await load();
    } catch (e) {
      setGenError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck(target: WatchTarget, domain: 'patent' | 'trademark') {
    const url = domain === 'patent'
      ? 'https://www.j-platpat.inpit.go.jp/p0300'
      : 'https://www.j-platpat.inpit.go.jp/t0300';
    await openJplatpat(url);
    await markChecked(target.id);
    await load();
  }

  async function handleDelete(id: number) {
    if (!window.confirm('この監視対象を削除しますか？')) return;
    await deleteWatchTarget(id);
    await load();
  }

  return (
    <div className="watch-page">
      <div className="page-header">
        <BackButton onClick={onBack} clusterColor={CLUSTER_COLOR} />
        <div className="page-header__meta">
          <span className="research-page__cluster-badge"
            style={{ background: CLUSTER_COLOR, color: '#fff' }}>
            監視する
          </span>
          <h2 className="research-page__title">競合知財ウォッチャー</h2>
        </div>
      </div>

      {/* 生成フォーム */}
      <section className="watch-section watch-section--form">
        <h3 className="watch-section__title">監視対象を追加</h3>
        <div className="watch-form">
          <div className="watch-form__row">
            <label className="watch-form__label">企業名 / ブランド名</label>
            <input
              className="watch-form__input"
              type="text"
              value={targetName}
              onChange={e => { setTargetName(e.target.value); setPreview(null); setSaved(false); }}
              placeholder="例: 株式会社サンプル / Sample Corp"
              onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
            />
          </div>
          <div className="watch-form__row">
            <label className="watch-form__label">監視法域</label>
            <div className="watch-form__radio-group">
              {LAW_DOMAIN_OPTIONS.map(opt => (
                <label key={opt.value} className="watch-form__radio">
                  <input
                    type="radio"
                    name="lawDomain"
                    value={opt.value}
                    checked={lawDomain === opt.value}
                    onChange={() => { setLawDomain(opt.value); setPreview(null); }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={generating || !targetName.trim()}
          >
            {generating ? '検索式を生成中…' : '検索式を生成'}
          </button>
        </div>

        {genError && <p className="watch-error">{genError}</p>}

        {preview && (
          <div className="watch-preview">
            <h4 className="watch-preview__title">生成された検索式</h4>
            {preview.patentExpression && (
              <div className="watch-preview__expr">
                <span className="watch-expr-label watch-expr-label--patent">特許・実用新案</span>
                <code className="watch-expr-code">{preview.patentExpression}</code>
              </div>
            )}
            {preview.trademarkExpression && (
              <div className="watch-preview__expr">
                <span className="watch-expr-label watch-expr-label--trademark">商標</span>
                <code className="watch-expr-code">{preview.trademarkExpression}</code>
              </div>
            )}
            {preview.notes && (
              <p className="watch-preview__notes">{preview.notes}</p>
            )}
            <div className="watch-preview__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '保存中…' : 'リストに保存'}
              </button>
            </div>
          </div>
        )}
        {saved && <p className="watch-saved">保存しました。</p>}
      </section>

      {/* 監視対象一覧 */}
      <section className="watch-section">
        <h3 className="watch-section__title">監視リスト</h3>
        {loading && <p className="watch-hint">読み込み中…</p>}
        {error && <p className="watch-error">{error}</p>}
        {!loading && targets.length === 0 && (
          <p className="watch-hint">まだ監視対象がありません。上のフォームから追加してください。</p>
        )}
        {targets.map(t => (
          <div key={t.id} className="watch-target-card">
            <div className="watch-target-card__header">
              <span className="watch-target-card__name">{t.name}</span>
              <span className={`watch-domain-badge watch-domain-badge--${t.lawDomain === 'both' ? 'both' : t.lawDomain === '特許' ? 'patent' : 'trademark'}`}>
                {t.lawDomain === 'both' ? '特許 + 商標' : t.lawDomain}
              </span>
              <button
                type="button"
                className="watch-target-card__delete"
                onClick={() => handleDelete(t.id)}
                title="削除"
              >
                ×
              </button>
            </div>

            {t.patentExpression && (
              <div className="watch-target-card__expr-row">
                <span className="watch-expr-label watch-expr-label--patent">特許</span>
                <code className="watch-expr-code watch-expr-code--sm">{t.patentExpression}</code>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => handleCheck(t, 'patent')}
                >
                  J-PlatPat で確認
                </button>
              </div>
            )}
            {t.trademarkExpression && (
              <div className="watch-target-card__expr-row">
                <span className="watch-expr-label watch-expr-label--trademark">商標</span>
                <code className="watch-expr-code watch-expr-code--sm">{t.trademarkExpression}</code>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => handleCheck(t, 'trademark')}
                >
                  J-PlatPat で確認
                </button>
              </div>
            )}
            {t.notes && <p className="watch-target-card__notes">{t.notes}</p>}

            <p className="watch-target-card__checked">
              最終確認: {formatDate(t.lastCheckedAt)}
            </p>
          </div>
        ))}
      </section>

      <DisclaimerBanner />
    </div>
  );
}
