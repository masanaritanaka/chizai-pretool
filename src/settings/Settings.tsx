import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { deleteApiKey, getApiKeyMasked, saveApiKey } from '../lib/keychain';
import { deleteNotionToken, hasNotionToken, saveNotionToken, testNotionConnection } from '../lib/notion';
import { getSettingValue, setSettingValue } from '../engines/manage/db';

type Status = 'loading' | 'idle' | 'saving' | 'error';

interface Props {
  thresholdDays: number;
  onThresholdChange: (days: number) => Promise<void>;
}

function ApiGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="modal__title">APIキーの取得方法</h3>
        <ol className="modal__steps">
          <li className="modal__step">
            <strong>Anthropic コンソールを開く</strong>
            <p>下のボタンをクリックするとブラウザが開きます。アカウントを持っていない場合は無料で作成できます。</p>
            <button
              type="button"
              className="modal__open-btn"
              onClick={() => open('https://console.anthropic.com/settings/keys')}
            >
              console.anthropic.com を開く →
            </button>
          </li>
          <li className="modal__step">
            <strong>キーを作成する</strong>
            <p>「API Keys」ページで「Create Key」をクリックし、名前を入力して作成します。</p>
          </li>
          <li className="modal__step">
            <strong>キーをこのアプリに登録する</strong>
            <p>表示されたキー（<code>sk-ant-...</code>）をコピーして、設定画面の入力欄に貼り付けて「保存」してください。キーはこの画面を閉じると二度と表示されないためご注意ください。</p>
          </li>
        </ol>
        <p className="modal__note">
          ※ APIの利用には従量課金が発生します。1回の調査で数円程度が目安です。
        </p>
        <div className="modal__actions">
          <button type="button" className="modal__close-btn" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings({ thresholdDays, onThresholdChange }: Props) {
  const [keyInput, setKeyInput] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [thresholdInput, setThresholdInput] = useState(String(thresholdDays));
  const [showGuide, setShowGuide] = useState(false);

  // Notion
  const [notionTokenInput, setNotionTokenInput] = useState('');
  const [notionHasToken, setNotionHasToken] = useState(false);
  const [notionDbId, setNotionDbId] = useState('');
  const [notionDbIdInput, setNotionDbIdInput] = useState('');
  const [notionTestResult, setNotionTestResult] = useState<string | null>(null);
  const [notionTestError, setNotionTestError] = useState<string | null>(null);
  const [notionSaving, setNotionSaving] = useState(false);

  useEffect(() => {
    hasNotionToken().then(setNotionHasToken).catch(() => {});
    getSettingValue('notion_database_id').then(v => {
      if (v) { setNotionDbId(v); setNotionDbIdInput(v); }
    }).catch(() => {});
  }, []);

  async function handleSaveNotionToken() {
    if (!notionTokenInput.trim()) return;
    setNotionSaving(true);
    try {
      await saveNotionToken(notionTokenInput.trim());
      setNotionTokenInput('');
      setNotionHasToken(true);
    } finally {
      setNotionSaving(false);
    }
  }

  async function handleDeleteNotionToken() {
    await deleteNotionToken();
    setNotionHasToken(false);
    setNotionTestResult(null);
    setNotionTestError(null);
  }

  async function handleTestNotion() {
    setNotionTestResult(null);
    setNotionTestError(null);
    try {
      const name = await testNotionConnection();
      setNotionTestResult(`接続成功: ${name}`);
    } catch (e) {
      setNotionTestError(String(e));
    }
  }

  async function handleSaveDbId() {
    const v = notionDbIdInput.trim();
    await setSettingValue('notion_database_id', v);
    setNotionDbId(v);
  }

  useEffect(() => {
    getApiKeyMasked()
      .then((masked) => {
        setMaskedKey(masked);
        setStatus('idle');
      })
      .catch((err) => {
        setErrorMessage(String(err));
        setStatus('error');
      });
  }, []);

  async function handleSave() {
    if (!keyInput.trim()) return;
    setStatus('saving');
    try {
      await saveApiKey(keyInput.trim());
      setKeyInput('');
      // キー全文は JS に保持しない。マスク版を再取得して表示のみ更新
      const masked = await getApiKeyMasked();
      setMaskedKey(masked);
      setStatus('idle');
    } catch (err) {
      setErrorMessage(String(err));
      setStatus('error');
    }
  }

  async function handleDelete() {
    setStatus('saving');
    try {
      await deleteApiKey();
      setMaskedKey(null);
      setStatus('idle');
    } catch (err) {
      setErrorMessage(String(err));
      setStatus('error');
    }
  }

  async function handleThresholdSave() {
    const n = parseInt(thresholdInput, 10);
    if (!isNaN(n) && n >= 1 && n <= 365) {
      await onThresholdChange(n);
    }
  }

  return (
    <div className="settings">
      <h2>設定</h2>

      {/* ── Claude API キー ── */}
      <section className="settings__section">
        <div className="settings__section-header">
          <h3>Claude APIキー</h3>
          <button
            type="button"
            className="api-guide-btn"
            onClick={() => setShowGuide(true)}
          >
            取得方法を見る
          </button>
        </div>
        <p className="settings__hint">
          APIキーは OS のキーチェーン（macOS Keychain / Windows 資格情報マネージャー）に保存されます。
          アプリやリポジトリに平文で残ることはありません。
        </p>

        {status === 'loading' && <p>読み込み中…</p>}

        {status !== 'loading' && (
          <>
            <p className="settings__status">
              現在のキー:{' '}
              {maskedKey
                ? <><code className="settings__masked-key">{maskedKey}</code> ✓</>
                : '未設定'}
            </p>
            <div className="settings__form">
              <input
                type="password"
                placeholder="sk-ant-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                autoComplete="off"
              />
              <button type="button" onClick={handleSave} disabled={!keyInput.trim() || status === 'saving'}>
                保存
              </button>
              {maskedKey && (
                <button type="button" onClick={handleDelete} disabled={status === 'saving'}>
                  削除
                </button>
              )}
            </div>
            {status === 'error' && <p className="settings__error">エラー: {errorMessage}</p>}
          </>
        )}
      </section>

      {/* ── 期限アラート閾値 ── */}
      <section className="settings__section">
        <h3>期限アラートの閾値</h3>
        <p className="settings__hint">
          期限まで何日以内の案件をアラート表示するかを設定します（1〜365日）。
        </p>
        <div className="settings__form settings__form--inline">
          <input
            type="number"
            min={1}
            max={365}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            style={{ width: '5rem' }}
          />
          <span className="settings__unit">日前</span>
          <button type="button" onClick={handleThresholdSave}>
            適用
          </button>
        </div>
        <p className="settings__status">現在の設定: {thresholdDays}日前</p>
      </section>

      {/* ── 外部連携 ── */}
      <section className="settings__section">
        <h3>外部連携</h3>

        {/* Notion */}
        <div className="settings__integration-card">
          <div className="settings__integration-header">
            <strong>Notion</strong>
            <span className="settings__integration-badge settings__integration-badge--notion">
              {notionHasToken ? '設定済み' : '未設定'}
            </span>
          </div>
          <p className="settings__hint">
            アイデアメモ（プリセット04）の分析結果を Notion データベースへ送信できます。
            インテグレーショントークン（<code>secret_...</code> または <code>ntn_...</code>）を登録してください。
          </p>
          <div className="settings__form">
            <input
              type="password"
              placeholder="secret_... または ntn_..."
              value={notionTokenInput}
              onChange={e => setNotionTokenInput(e.target.value)}
              autoComplete="off"
            />
            <button type="button" onClick={handleSaveNotionToken} disabled={!notionTokenInput.trim() || notionSaving}>
              保存
            </button>
            {notionHasToken && (
              <button type="button" onClick={handleDeleteNotionToken}>削除</button>
            )}
          </div>
          {notionHasToken && (
            <div className="settings__form" style={{ marginTop: '0.5rem' }}>
              <button type="button" onClick={handleTestNotion} className="api-guide-btn">
                接続テスト
              </button>
              {notionTestResult && <span className="settings__status" style={{ color: '#065F46' }}>{notionTestResult}</span>}
              {notionTestError && <span className="settings__error">{notionTestError}</span>}
            </div>
          )}

          {/* データベースID */}
          <div className="settings__field" style={{ marginTop: '0.85rem' }}>
            <label className="settings__field-label">
              Notion データベース ID
              {notionDbId && <span className="settings__status" style={{ marginLeft: '0.5rem' }}>✓ 設定済み</span>}
            </label>
            <p className="settings__hint" style={{ marginTop: 0 }}>
              送信先 Notion データベースの ID（URL の 32 桁英数字部分）を入力してください。
            </p>
            <div className="settings__form">
              <input
                type="text"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={notionDbIdInput}
                onChange={e => setNotionDbIdInput(e.target.value)}
              />
              <button type="button" onClick={handleSaveDbId} disabled={!notionDbIdInput.trim()}>
                適用
              </button>
            </div>
          </div>
        </div>

        {/* Google Docs — 準備中 */}
        <div className="settings__integration-card settings__integration-card--disabled">
          <div className="settings__integration-header">
            <strong>Google Docs</strong>
            <span className="settings__integration-badge settings__integration-badge--coming">
              準備中
            </span>
          </div>
          <p className="settings__hint">
            Google Docs 連携は今後のアップデートで対応予定です。
          </p>
          <button type="button" disabled className="settings__disabled-btn">
            Google Docs に送る（準備中）
          </button>
        </div>
      </section>

      {showGuide && <ApiGuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
