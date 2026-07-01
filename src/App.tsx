import { useState } from 'react';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { ResearchPage } from './engines/research/ResearchPage';
import { Home } from './home/Home';
import type { Preset } from './home/presets';
import { Settings } from './settings/Settings';
import './App.css';

type View = { name: 'home' } | { name: 'settings' } | { name: 'preset'; preset: Preset };

function App() {
  const [view, setView] = useState<View>({ name: 'home' });

  function handleSelectPreset(preset: Preset) {
    setView({ name: 'preset', preset });
  }

  function renderMain() {
    if (view.name === 'home') {
      return <Home onSelectPreset={handleSelectPreset} />;
    }
    if (view.name === 'settings') {
      return <Settings />;
    }

    const { preset } = view;

    // Phase 1: Research engine (presets 1, 3, 4)
    if (preset.engine === 'research' && [1, 3, 4].includes(preset.id)) {
      return (
        <ResearchPage
          preset={preset}
          onBack={() => setView({ name: 'home' })}
        />
      );
    }

    // Placeholder for unimplemented presets
    return (
      <div className="preset-placeholder">
        <button type="button" className="preset-placeholder__back" onClick={() => setView({ name: 'home' })}>
          ← ホーム
        </button>
        <h2>{preset.label}</h2>
        <p>法域: {preset.lawDomains.join(' / ')} &nbsp;/&nbsp; エンジン: {preset.engine}</p>
        <p className="preset-placeholder__phase">Phase {preset.phase} で実装予定です。</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <button type="button" className="app__title" onClick={() => setView({ name: 'home' })}>
          知財プリツール
        </button>
        <button
          type="button"
          className="app__settings-button"
          onClick={() => setView({ name: 'settings' })}
        >
          設定
        </button>
      </header>

      <main className="app__main">{renderMain()}</main>

      {view.name !== 'preset' || !([1, 3, 4].includes((view as { name: 'preset'; preset: Preset }).preset?.id)) ? (
        <DisclaimerBanner />
      ) : null}
    </div>
  );
}

export default App;
