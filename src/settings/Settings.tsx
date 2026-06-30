import { useEffect, useState } from 'react';
import { deleteApiKey, getApiKey, saveApiKey } from '../lib/keychain';

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

export function Settings() {
  const [keyInput, setKeyInput] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');

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
      setStatus('saved');
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

  return (
    <div className="settings">
      <h2>設定</h2>

      <section className="settings__section">
        <h3>Claude APIキー</h3>
        <p className="settings__hint">
          APIキーは OS のキーチェーン（macOS Keychain / Windows 資格情報マネージャー）に保存されます。
          このアプリやリポジトリに平文で保存されることはありません。
        </p>

        {status === 'loading' && <p>読み込み中…</p>}

        {status !== 'loading' && (
          <>
            <p className="settings__status">
              現在のキー: {hasStoredKey ? '保存済み' : '未設定'}
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
    </div>
  );
}
