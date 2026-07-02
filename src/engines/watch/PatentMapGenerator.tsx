import { useState } from 'react';
import { BackButton } from '../../components/BackButton';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { callClaude } from '../../lib/claude';
import { openJplatpat } from '../../lib/jplatpat';
import { buildPatentMapUserMessage, PATENT_MAP_PROMPT } from './prompts';
import type { PatentMapAxis, PatentMapResult } from './types';

const CLUSTER_COLOR = '#C2740C';
const PATENT_SEARCH_URL = 'https://www.j-platpat.inpit.go.jp/p0300';

const AXIS_COLORS = ['#4F46E5', '#0891B2', '#059669', '#D97706', '#DC2626'];

function parseMapResult(raw: string): PatentMapResult {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned) as PatentMapResult;
}

function AxisCard({ axis, index, onSearch }: {
  axis: PatentMapAxis;
  index: number;
  onSearch: (expr: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const color = AXIS_COLORS[index % AXIS_COLORS.length];

  return (
    <div className="map-axis">
      <button
        type="button"
        className="map-axis__header"
        style={{ '--axis-color': color } as React.CSSProperties}
        onClick={() => setExpanded(v => !v)}
      >
        <span className="map-axis__toggle">{expanded ? '▾' : '▸'}</span>
        <span className="map-axis__label">{axis.label}</span>
        {axis.ipc && <span className="map-axis__ipc">{axis.ipc}</span>}
        <span className="map-axis__desc">{axis.description}</span>
        <button
          type="button"
          className="btn btn--outline btn--sm map-axis__search-btn"
          onClick={e => { e.stopPropagation(); onSearch(axis.patentExpression); }}
          title={axis.patentExpression}
        >
          J-PlatPat ↗
        </button>
      </button>

      {expanded && (
        <div className="map-axis__sub-list">
          {axis.subAxes.map((sub, si) => (
            <div key={si} className="map-subaxis">
              <span className="map-subaxis__label">{sub.label}</span>
              <span className="map-subaxis__desc">{sub.description}</span>
              <code className="map-subaxis__expr">{sub.patentExpression}</code>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => onSearch(sub.patentExpression)}
                title={sub.patentExpression}
              >
                J-PlatPat ↗
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  onBack: () => void;
}

export function PatentMapGenerator({ onBack }: Props) {
  const [techField, setTechField] = useState('');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PatentMapResult | null>(null);

  async function handleGenerate() {
    if (!techField.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const user = buildPatentMapUserMessage(techField, keywords);
      const raw = await callClaude(PATENT_MAP_PROMPT, user);
      setResult(parseMapResult(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(expr: string) {
    await openJplatpat(PATENT_SEARCH_URL);
    // 検索式をクリップボードにコピーして通知
    try {
      await navigator.clipboard.writeText(expr);
    } catch {
      // clipboard API 未対応環境は無視
    }
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
          <h2 className="research-page__title">特許マップ自動生成</h2>
        </div>
      </div>

      {/* 入力フォーム */}
      <section className="watch-section watch-section--form">
        <h3 className="watch-section__title">技術分野を入力</h3>
        <div className="watch-form">
          <div className="watch-form__row">
            <label className="watch-form__label">技術分野</label>
            <textarea
              className="watch-form__textarea"
              value={techField}
              onChange={e => setTechField(e.target.value)}
              placeholder="例: 機械学習を用いた画像認識技術、フレキシブルディスプレイの製造プロセス"
              rows={3}
            />
          </div>
          <div className="watch-form__row">
            <label className="watch-form__label">追加キーワード（任意）</label>
            <input
              className="watch-form__input"
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="例: CNN, OLED, 薄膜"
            />
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={loading || !techField.trim()}
          >
            {loading ? 'マップ生成中…' : '特許マップを生成'}
          </button>
        </div>
        {error && <p className="watch-error">{error}</p>}
      </section>

      {/* 出力：マップ */}
      {result && (
        <section className="watch-section watch-section--map">
          <div className="map-header">
            <h3 className="map-header__title">{result.title}</h3>
            <p className="map-header__summary">{result.summary}</p>
          </div>

          <div className="map-hint">
            <span>ボタン「J-PlatPat ↗」をクリックすると特許テキスト検索が開きます。検索式は自動的にクリップボードにコピーされます。</span>
          </div>

          <div className="map-axes">
            {result.axes.map((axis, i) => (
              <AxisCard
                key={i}
                axis={axis}
                index={i}
                onSearch={handleSearch}
              />
            ))}
          </div>

          {result.expertQuestions.length > 0 && (
            <div className="watch-expert-q">
              <h4 className="watch-expert-q__title">専門家に確認すべき事項</h4>
              <ul className="watch-expert-q__list">
                {result.expertQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <DisclaimerBanner />
    </div>
  );
}
