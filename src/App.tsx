import { useEffect, useState } from 'react';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { ResearchPage } from './engines/research/ResearchPage';
import { DeadlineManager } from './engines/manage/DeadlineManager';
import { DefensiveDisclosures } from './engines/manage/DefensiveDisclosures';
import { getSettingValue, listNearDeadlines, setSettingValue } from './engines/manage/db';
import { Home } from './home/Home';
import type { Preset } from './home/presets';
import { Settings } from './settings/Settings';
import './App.css';

const DEFAULT_THRESHOLD = 30;
const THRESHOLD_SETTING_KEY = 'deadline_threshold_days';

type View = { name: 'home' } | { name: 'settings' } | { name: 'preset'; preset: Preset };

function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [nearDeadlineCount, setNearDeadlineCount] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

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

    // Phase 1 + 3: Research engine (presets 1, 2, 3, 4, 5, 9)
    if (preset.engine === 'research') {
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

    // Placeholder for unimplemented presets
    return (
      <div className="preset-placeholder">
        <button type="button" className="preset-placeholder__back" onClick={handleBack}>← ホーム</button>
        <h2>{preset.label}</h2>
        <p>法域: {preset.lawDomains.join(' / ')} &nbsp;/&nbsp; エンジン: {preset.engine}</p>
        <p className="preset-placeholder__phase">Phase {preset.phase} で実装予定です。</p>
      </div>
    );
  }

  const isResearchPage =
    view.name === 'preset' && view.preset.engine === 'research';

  return (
    <div className="app">
      <header className="app__header">
        <button type="button" className="app__title" onClick={() => setView({ name: 'home' })}>
          知財プリツール
        </button>
        <button type="button" className="app__settings-button" onClick={() => setView({ name: 'settings' })}>
          設定
        </button>
      </header>

      <main className="app__main">{renderMain()}</main>

      {!isResearchPage && <DisclaimerBanner />}
    </div>
  );
}

export default App;
