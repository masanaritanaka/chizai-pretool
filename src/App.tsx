import { useEffect, useState } from 'react';
import { BackButton } from './components/BackButton';
import { CommandPalette } from './components/CommandPalette';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { ResearchPage } from './engines/research/ResearchPage';
import { IdeaMemoPage } from './engines/research/IdeaMemoPage';
import { DeadlineManager } from './engines/manage/DeadlineManager';
import { DefensiveDisclosures } from './engines/manage/DefensiveDisclosures';
import { getSettingValue, listNearDeadlines, setSettingValue } from './engines/manage/db';
import { CompetitorWatcher } from './engines/watch/CompetitorWatcher';
import { PatentMapGenerator } from './engines/watch/PatentMapGenerator';
import { Home } from './home/Home';
import type { Preset } from './home/presets';
import { clusterColor, presets } from './home/presets';
import { Settings } from './settings/Settings';
import './App.css';

const DEFAULT_THRESHOLD = 30;
const THRESHOLD_SETTING_KEY = 'deadline_threshold_days';

type View = { name: 'home' } | { name: 'settings' } | { name: 'preset'; preset: Preset };

function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [nearDeadlineCount, setNearDeadlineCount] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pendingMemoId, setPendingMemoId] = useState<number | null>(null);

  // Cmd+K / Ctrl+K でコマンドパレットを開く
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function handleCommandPaletteSelectMemo(id: number) {
    setCommandPaletteOpen(false);
    setPendingMemoId(id);
    const p4 = presets.find(p => p.id === 4);
    if (p4) setView({ name: 'preset', preset: p4 });
  }

  // DBから閾値を初期ロード
  useEffect(() => {
    getSettingValue(THRESHOLD_SETTING_KEY)
      .then(v => { if (v !== null) setThreshold(Number(v)); })
      .catch(() => {}); // DB初期化前は無視
  }, []);

  async function refreshAlerts() {
    try {
      const near = await listNearDeadlines(threshold);
      setNearDeadlineCount(near.length);

      // OS通知（任意・エラーは無視）
      if (near.length > 0) {
        try {
          const { isPermissionGranted, requestPermission, sendNotification } =
            await import('@tauri-apps/plugin-notification');
          let granted = await isPermissionGranted();
          if (!granted) {
            granted = (await requestPermission()) === 'granted';
          }
          if (granted) {
            sendNotification({
              title: '知財プリツール — 期限接近',
              body: `${near.length}件の案件で${threshold}日以内に期限が近づいています。`,
            });
          }
        } catch {
          // 通知は best-effort: 失敗しても続行
        }
      }
    } catch {
      // DB 未初期化など起動直後のエラーは無視
    }
  }

  useEffect(() => {
    refreshAlerts();
  }, [threshold]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleThresholdChange(days: number) {
    await setSettingValue(THRESHOLD_SETTING_KEY, String(days));
    setThreshold(days);
  }

  function handleSelectPreset(preset: Preset) {
    setView({ name: 'preset', preset });
  }

  function handleBack() {
    setView({ name: 'home' });
    refreshAlerts(); // 管理ページから戻ったらアラートを更新
  }

  function renderMain() {
    if (view.name === 'home') {
      return (
        <Home
          onSelectPreset={handleSelectPreset}
          nearDeadlineCount={nearDeadlineCount}
        />
      );
    }
    if (view.name === 'settings') {
      return (
        <Settings
          thresholdDays={threshold}
          onThresholdChange={handleThresholdChange}
        />
      );
    }

    const { preset } = view;

    // Preset 04: アイデアメモDB付き専用ページ
    if (preset.id === 4) {
      return (
        <IdeaMemoPage
          preset={preset}
          onBack={handleBack}
          initialMemoId={pendingMemoId}
          onClearInitialMemoId={() => setPendingMemoId(null)}
        />
      );
    }

    // Phase 1 + 3: Research engine (presets 1, 2, 3, 5, 9)
    if (preset.engine === 'research' || preset.engine === 'research-vision') {
      return <ResearchPage preset={preset} onBack={handleBack} />;
    }

    // Phase 2: Manage (preset 6)
    if (preset.id === 6) {
      return <DeadlineManager thresholdDays={threshold} onBack={handleBack} />;
    }

    // Phase 2: Manage (preset 10)
    if (preset.id === 10) {
      return <DefensiveDisclosures onBack={handleBack} />;
    }

    // Phase 4: Watch (preset 7)
    if (preset.id === 7) {
      return <CompetitorWatcher onBack={handleBack} />;
    }

    // Phase 4: Watch (preset 8)
    if (preset.id === 8) {
      return <PatentMapGenerator onBack={handleBack} />;
    }

    // フォールバック（全 Phase 実装済みのため到達しないはず）
    const pColor = clusterColor[preset.cluster];
    return (
      <div className="preset-placeholder">
        <div className="page-header">
          <BackButton onClick={handleBack} clusterColor={pColor} />
          <div className="page-header__meta">
            <span className="research-page__cluster-badge" style={{ background: pColor, color: '#fff' }}>
              {preset.cluster}
            </span>
            <h2 className="research-page__title" style={{ fontSize: '1.3rem' }}>{preset.label}</h2>
          </div>
        </div>
      </div>
    );
  }

  const isResearchPage =
    view.name === 'preset' &&
    (view.preset.engine === 'research' || view.preset.engine === 'research-vision');

  return (
    <div className="app">
      <header className="app__header">
        <button type="button" className="app__title" onClick={() => setView({ name: 'home' })}>
          知財プリツール
        </button>
        <div className="app__header-actions">
          <button
            type="button"
            className="app__search-button"
            onClick={() => setCommandPaletteOpen(true)}
            title="アイデアメモを検索 (⌘K)"
          >
            🔍 <kbd>⌘K</kbd>
          </button>
          <button type="button" className="app__settings-button" onClick={() => setView({ name: 'settings' })}>
            設定
          </button>
        </div>
      </header>

      <main className="app__main">
        {renderMain()}
      </main>

      {!isResearchPage && <DisclaimerBanner />}

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectMemo={handleCommandPaletteSelectMemo}
      />
    </div>
  );
}

export default App;
