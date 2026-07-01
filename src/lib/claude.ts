import { fetch } from '@tauri-apps/plugin-http';
import { getApiKey } from './keychain';

export type ClaudeErrorType = 'no_key' | 'network' | 'rate_limit' | 'api_error';

export interface ClaudeError {
  readonly isClaudeError: true;
  readonly errorType: ClaudeErrorType;
  readonly message: string;
}

function makeError(errorType: ClaudeErrorType, message: string): ClaudeError {
  return { isClaudeError: true, errorType, message };
}

export function isClaudeError(e: unknown): e is ClaudeError {
  return typeof e === 'object' && e !== null && (e as ClaudeError).isClaudeError === true;
}

export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw makeError(
      'no_key',
      'Claude APIキーが設定されていません。右上の「設定」から登録してください。',
    );
  }

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch {
    throw makeError(
      'network',
      'ネットワークエラーが発生しました。インターネット接続を確認してください。',
    );
  }

  if (response.status === 429) {
    throw makeError(
      'rate_limit',
      'レート制限に達しました。しばらく待ってから再試行してください。',
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail = `ステータス ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed?.error?.message) detail += `: ${parsed.error.message}`;
    } catch {
      // ignore
    }
    throw makeError('api_error', `API エラー — ${detail}`);
  }

  const data = await response.json() as { content: { text: string }[] };
  return data.content[0].text;
}
