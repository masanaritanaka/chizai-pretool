import { clusters, clusterColor, photoPath, presetsByCluster, type Preset } from './presets';

interface HomeProps {
  onSelectPreset: (preset: Preset) => void;
}

const clusterDescriptions: Record<string, string> = {
  調べる: '入力した情報を構造化し、検索式と論点をまとめます',
  監視する: '監視したい対象の検索式を生成し、J-PlatPat で確認します',
  管理する: '出願・登録のステータスや期限をローカルで管理します',
};

export function Home({ onSelectPreset }: HomeProps) {
  return (
    <div className="home">
      {clusters.map((cluster) => (
        <section key={cluster} className="cluster">
          <h2 className="cluster__title">{cluster}</h2>
          <p className="cluster__description">{clusterDescriptions[cluster]}</p>
          <div className="cluster__grid">
            {presetsByCluster(cluster).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-card"
                onClick={() => onSelectPreset(preset)}
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
                  {/* デュオトーンオーバーレイ */}
                  <div
                    className="preset-card__duotone"
                    style={{ backgroundColor: clusterColor[cluster] }}
                  />
                  {/* 通し番号 */}
                  <span className="preset-card__number">
                    {String(preset.id).padStart(2, '0')}
                  </span>
                </div>

                <div className="preset-card__body">
                  <span className="preset-card__label">{preset.label}</span>
                  <span className="preset-card__domains">{preset.lawDomains.join(' / ')}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
