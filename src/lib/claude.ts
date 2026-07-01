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
        messages: [{ role: 'user', content: userContent }],
      }),
    });
  } catch {
    throw makeError(
      'network',
      'ネットワークエラーが発生しました。インターネット接続を確認してください。',
    );
  }

  if (response.status === 429) {
    throw makeError('rate_limit', 'レート制限に達しました。しばらく待ってから再試行してください。');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail = `ステータス ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed?.error?.message) detail += `: ${parsed.error.message}`;
    } catch { /* ignore */ }
    throw makeError('api_error', `API エラー — ${detail}`);
  }

  const data = await response.json() as { content: { text: string }[] };
  return data.content[0].text;
}

/** テキスト入力で Claude を呼び出す */
export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  return post(systemPrompt, userMessage);
}

/**
 * 画像に含まれる文字を Claude Vision で書き起こす（OCR代替）。
 * 返ってきたテキストは通常のテキスト入力パイプラインに渡す。
 */
export async function callClaudeOcr(
  imageBase64: string,
  mediaType: ImageMediaType,
): Promise<string> {
  const system =
    'You are a precise OCR engine. Extract all visible text from the image verbatim, preserving line breaks and structure as much as possible. Output only the extracted text with no explanation or commentary.';
  const userText =
    '画像内に含まれるすべての文字をそのまま書き起こしてください。改行・リスト・表の構造を可能な限り保持し、説明なしに書き起こしテキストのみを出力してください。';
  return post(system, [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
    { type: 'text', text: userText },
  ]);
}

/**
 * Vision 入力（画像 + 補足テキスト）で Claude を呼び出す。
 * imageBase64 は "data:" プレフィクスなしの純粋な Base64 文字列。
 */
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
