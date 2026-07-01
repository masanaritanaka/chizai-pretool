import { useEffect, useState } from 'react';
import { deleteApiKey, getApiKey, saveApiKey } from '../lib/keychain';

type Status = 'loading' | 'idle' | 'saving' | 'error';

interface Props {
  thresholdDays: number;
  onThresholdChange: (days: number) => void;
}

export function Settings({ thresholdDays, onThresholdChange }: Props) {
  const [keyInput, setKeyInput] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [thresholdInput, setThresholdInput] = useState(String(thresholdDays));

  useEffect(() => {
    getApiKey()
      .then((key) => {
        setHasStoredKey(key !== null);
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
      setHasStoredKey(true);
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
      setHasStoredKey(false);
      setStatus('idle');
    } catch (err) {
      setErrorMessage(String(err));
      setStatus('error');
    }
  }

  function handleThresholdSave() {
    const n = parseInt(thresholdInput, 10);
    if (!isNaN(n) && n >= 1 && n <= 365) {
      onThresholdChange(n);
    }
  }

  return (
    <div className="settings">
      <h2>設定</h2>

      {/* ── Claude API キー ── */}
      <section className="settings__section">
        <h3>Claude APIキー</h3>
        <p className="settings__hint">
          APIキーは OS のキーチェーン（macOS Keychain / Windows 資格情報マネージャー）に保存されます。
          アプリやリポジトリに平文で残ることはありません。
        </p>

        {status === 'loading' && <p>読み込み中…</p>}

        {status !== 'loading' && (
          <>
            <p className="settings__status">
              現在のキー: {hasStoredKey ? '保存済み ✓' : '未設定'}
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
              {hasStoredKey && (
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
    </div>
  );
}
