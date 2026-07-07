import { invoke } from '@tauri-apps/api/core';

export type ClaudeErrorType =
  | 'no_key'
  | 'network'
  | 'auth'
  | 'billing'
  | 'rate_limit'
  | 'api_error';

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

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

type UserContent = string | ContentBlock[];

interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: ImageMediaType;
    data: string;
  };
}

async function post(systemPrompt: string, userContent: UserContent): Promise<string> {
  // APIキーは Rust コマンド内で OS キーチェーンから直接取得。JS には渡さない。
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  let responseText: string;
  try {
    responseText = await invoke<string>('call_claude_api', { body });
  } catch (e: unknown) {
    const raw = String(e);
    if (import.meta.env.DEV) console.error('[CLAUDE_INVOKE_ERROR]', raw);

    // キー未設定（Rust 側がキーチェーンから取得できなかった）
    if (raw === 'NO_KEY') {
      throw makeError(
        'no_key',
        'Claude APIキーが設定されていません。右上の「設定」から登録してください。',
      );
    }

    if (raw.startsWith('HTTP:')) {
      const firstColon  = raw.indexOf(':');
      const secondColon = raw.indexOf(':', firstColon + 1);
      const status      = Number(raw.slice(firstColon + 1, secondColon));
      const bodyText    = raw.slice(secondColon + 1);

      if (status === 401) {
        throw makeError(
          'auth',
          'APIキーが無効です。設定画面で正しいキーを確認・再登録してください。',
        );
      }
      if (status === 402 || status === 529) {
        throw makeError(
          'billing',
          `残高不足またはサービス一時停止中です（${status}）。`,
        );
      }
      if (status === 429) {
        throw makeError(
          'rate_limit',
          'しばらく待ってから再試行してください（目安: 1〜2分）。',
        );
      }

      let detail = `ステータス ${status}`;
      try {
        const parsed = JSON.parse(bodyText) as { error?: { message?: string; type?: string } };
        if (parsed?.error?.message) detail += `: ${parsed.error.message}`;
        if (parsed?.error?.type) detail += ` (${parsed.error.type})`;
      } catch { /* ignore */ }
      throw makeError('api_error', `API エラー — ${detail}`);
    }

    if (raw.startsWith('NETWORK:')) {
      throw makeError('network', `ネットワークエラー: ${raw.slice(8, 300)}`);
    }

    throw makeError('network', `エラー: ${raw.slice(0, 300)}`);
  }

  const data = JSON.parse(responseText) as { content: { text: string }[] };
  return data.content[0].text;
}

/** テキスト入力で Claude を呼び出す */
export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  return post(systemPrompt, userMessage);
}

export async function callClaudeOcr(
  imageBase64: string,
  mediaType: ImageMediaType,
): Promise<string> {
  const system =
    'You are an expert document analyzer for patent and technical documents. Your task: ' +
    '(1) Extract ALL visible text verbatim, preserving line breaks, lists, and table structure. ' +
    '(2) If the image contains figures, drawings, diagrams, graphs, or photographs, append a section ' +
    '"=== 図面・図表の説明 ===" and describe each one in detail in Japanese: shapes, arrows, labels, ' +
    'reference numbers, and their apparent relationships or function. ' +
    'Output only the extracted content — no preamble or commentary.';
  const userText =
    '画像内の文字をすべて書き起こしてください。また、図面・図表・グラフ・写真が含まれている場合は、' +
    '「=== 図面・図表の説明 ===」という見出しを付けて、それぞれの内容を日本語で詳しく説明してください' +
    '（形状・矢印・参照番号の関係、部品の配置など）。説明のみ出力してください。';
  return post(system, [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
    { type: 'text', text: userText },
  ]);
}

export async function callClaudeVision(
  systemPrompt: string,
  imageBase64: string,
  mediaType: ImageMediaType,
  textDescription: string,
): Promise<string> {
  const content: ContentBlock[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: imageBase64,
      },
    },
    {
      type: 'text',
      text: textDescription || '画像を分析してください。',
    },
  ];
  return post(systemPrompt, content);
}
