import { invoke } from '@tauri-apps/api/core';

export async function saveNotionToken(token: string): Promise<void> {
  await invoke('save_notion_token', { token });
}

export async function hasNotionToken(): Promise<boolean> {
  return invoke<boolean>('has_notion_token');
}

export async function deleteNotionToken(): Promise<void> {
  await invoke('delete_notion_token');
}

/** 接続テスト: 成功時はボット名を返す */
export async function testNotionConnection(): Promise<string> {
  return invoke<string>('test_notion_connection');
}

/**
 * メモを Notion データベースページとして送信する。
 * Notion トークンは Rust 側でキーチェーンから取得するため、フロントに渡さない。
 * @returns 作成された Notion ページの URL
 */
export async function sendToNotion(
  title: string,
  memoJson: string,
  tags: string,
  databaseId: string,
): Promise<string> {
  return invoke<string>('send_to_notion', {
    title,
    memoJson,
    tags,
    databaseId,
  });
}
