import { invoke } from '@tauri-apps/api/core';

export async function saveApiKey(key: string): Promise<void> {
  await invoke('save_api_key', { key });
}

/** キーをマスクして返す ("sk-ant-...XXXX" 形式)。キー全文は JS に渡らない。 */
export async function getApiKeyMasked(): Promise<string | null> {
  return invoke<string | null>('get_api_key_masked');
}

export async function deleteApiKey(): Promise<void> {
  await invoke('delete_api_key');
}
