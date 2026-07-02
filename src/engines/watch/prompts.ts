import type { WatchLawDomain } from './types';

const DISCLAIMER = `
あなたは知財初期調査の補助アシスタントです。
【制約】登録可能性・権利侵害の有無を判定・保証しません。法的助言を行いません。
最終判断は必ず弁理士・知財部に委ねるよう促してください。
`.trim();

export function buildWatchQueryPrompt(lawDomain: WatchLawDomain): string {
  const domains =
    lawDomain === 'both' ? '特許・実用新案と商標の両方' :
    lawDomain === '特許' ? '特許・実用新案' : '商標';

  return `${DISCLAIMER}

【タスク: 競合知財ウォッチャー — J-PlatPat 出願人検索式生成】
入力された企業名・ブランド名について、${domains}の出願人検索式を生成してください。

出力は以下の JSON のみ。マークダウン記号・コードブロックを含めないこと。

{
  "patentExpression": "J-PlatPat 特許テキスト検索用出願人式（例: AD/株式会社◯◯ OR AD/○○ Inc.）。特許不要なら空文字",
  "trademarkExpression": "J-PlatPat 商標テキスト検索用出願人式（例: AP/株式会社◯◯ OR AP/○○ Inc.）。商標不要なら空文字",
  "notes": "検索のヒント・表記揺れ・関連子会社名・注意事項（200文字以内）"
}

フィールドコード説明:
- 特許出願人: AD/企業名（J-PlatPat 特許テキスト検索の出願人フィールド）
- 商標出願人: AP/企業名（J-PlatPat 商標テキスト検索の出願人フィールド）
- 複数表記は OR で連結（日本語名・英語名・略称を網羅すること）`;
}

export function buildWatchQueryUserMessage(targetName: string): string {
  return `【監視対象】\n${targetName.trim()}`;
}

export const PATENT_MAP_PROMPT = `${DISCLAIMER}

【タスク: 特許マップ自動生成】
入力された技術分野・キーワードを元に、特許調査のための観点マップを生成してください。
大分類（axes）は 3〜5 個、各大分類に小分類（subAxes）を 2〜4 個設けてください。

出力は以下の JSON のみ。マークダウン記号・コードブロックを含めないこと。

{
  "title": "技術分野のタイトル（20文字以内）",
  "summary": "技術分野の概要と特許調査上の論点（100文字程度）",
  "axes": [
    {
      "label": "大分類ラベル（15文字以内）",
      "description": "この分類の説明（60文字以内）",
      "ipc": "主要 IPC/FI 分類コード（例: G06F 17/00）",
      "patentExpression": "J-PlatPat 特許テキスト検索式（この大分類全体をカバー）",
      "subAxes": [
        {
          "label": "小分類ラベル（15文字以内）",
          "description": "説明（60文字以内）",
          "patentExpression": "より絞り込んだ検索式"
        }
      ]
    }
  ],
  "expertQuestions": ["弁理士・技術者に確認すべき事項（3〜5件）"]
}

検索式の書き方:
- テキスト検索: (キーワード1) AND (キーワード2)
- フィールド指定: /AB=要約, /TI=名称, /CL=クレーム（省略時は全文）
- 英語キーワードと日本語キーワードを OR で組み合わせること`;

export function buildPatentMapUserMessage(techField: string, keywords: string): string {
  const parts = [`【技術分野】\n${techField.trim()}`];
  if (keywords.trim()) parts.push(`【キーワード】\n${keywords.trim()}`);
  return parts.join('\n\n');
}
