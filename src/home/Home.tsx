import { clusters, presetsByCluster, type Preset } from './presets';

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
                className="preset-button"
                onClick={() => onSelectPreset(preset)}
              >
                <span className="preset-button__label">{preset.label}</span>
                <span className="preset-button__domains">{preset.lawDomains.join(' / ')}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
