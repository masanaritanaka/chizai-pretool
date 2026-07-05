import { clusters, clusterColor, photoPath, presetsByCluster, type Preset } from './presets';

const LAW_DOMAIN_COLORS: Record<string, string> = {
  特許: '#2563EB',
  商標: '#7C3AED',
  意匠: '#DB2777',
  実用新案: '#059669',
  契約: '#D97706',
};

interface HomeProps {
  onSelectPreset: (preset: Preset) => void;
  nearDeadlineCount?: number;
}

const clusterDescriptions: Record<string, string> = {
  調べる: '社名・アイデア・契約書などを入力すると、AIがリスクや論点をわかりやすくまとめます',
  監視する: '競合他社の出願動向を把握するための検索キーワードを作成・管理します',
  管理する: '出願・更新の期限やアイデアのメモを、自分のPCだけで安全に管理します',
};

export function Home({ onSelectPreset, nearDeadlineCount = 0 }: HomeProps) {
  return (
    <div className="home">
      {clusters.map((cluster) => (
        <section key={cluster} className="cluster">
          <div className="cluster__heading-row">
            <h2 className="cluster__title">{cluster}</h2>
            {cluster === '管理する' && nearDeadlineCount > 0 && (
              <span className="deadline-badge">
                ⚠ {nearDeadlineCount}件 期限接近
              </span>
            )}
          </div>
          <p className="cluster__description">{clusterDescriptions[cluster]}</p>
          <div className="cluster__grid">
            {presetsByCluster(cluster).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-card"
                onClick={() => onSelectPreset(preset)}
                data-tip={preset.description}
              >
                <div className="preset-card__photo-wrap">
                  <img
                    src={photoPath(preset.id)}
                    alt=""
                    className="preset-card__photo"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div
                    className="preset-card__duotone"
                    style={{ backgroundColor: clusterColor[cluster] }}
                  />
                  <span className="preset-card__number">
                    {String(preset.id).padStart(2, '0')}
                  </span>
                </div>

                <div className="preset-card__body">
                  <span className="preset-card__label">{preset.label}</span>
                  <div className="preset-card__domains">
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
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
