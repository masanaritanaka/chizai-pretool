import { useState } from 'react';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { Home } from './home/Home';
import type { Preset } from './home/presets';
import { Settings } from './settings/Settings';
import './App.css';

type View = { name: 'home' } | { name: 'settings' } | { name: 'preset'; preset: Preset };

function App() {
  const [view, setView] = useState<View>({ name: 'home' });

  return (
    <div className="app">
      <header className="app__header">
        <button
          type="button"
          className="app__title"
          onClick={() => setView({ name: 'home' })}
        >
          知財プリツール
        </button>
        <button type="button" className="app__settings-button" onClick={() => setView({ name: 'settings' })}>
          設定
        </button>
      </header>

      <main className="app__main">
        {view.name === 'home' && <Home onSelectPreset={(preset) => setView({ name: 'preset', preset })} />}
        {view.name === 'settings' && <Settings />}
        {view.name === 'preset' && (
          <div className="preset-placeholder">
            <button type="button" onClick={() => setView({ name: 'home' })}>
              ← Home に戻る
            </button>
            <h2>{view.preset.label}</h2>
            <p>
              法域: {view.preset.lawDomains.join(' / ')} / エンジン: {view.preset.engine}
            </p>
            <p>このプリセットは Phase {view.preset.phase} で実装予定です。</p>
          </div>
        )}
      </main>

      <DisclaimerBanner />
    </div>
  );
}

export default App;
