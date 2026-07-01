import type { Preset } from '../../home/presets';

const DISCLAIMER = `
あなたは知財初期調査の補助アシスタントです。
【制約】登録可能性・権利侵害の有無を判定・保証しません。法的助言を行いません。
最終判断は必ず弁理士・知財部に委ねるよう促してください。
`.trim();

const JSON_SCHEMA = `
出力は以下の JSON スキーマに厳密に従ってください。JSON 以外の文字（マークダウン記号・コードブロック等）を含めないこと。

{
  "technicalField": "string",
  "problem": "string",
  "solution": "string",
  "components": ["string"],
  "synonymsAndEnglish": ["string"],
  "riskAssessment": "string",
  "expertQuestions": ["string"],
  "searchKeywords": ["string（J-PlatPat検索に使える日本語・英語キーワード）"]
}
`.trim();

const PRESET_INSTRUCTIONS: Record<number, string> = {
  1: `
【タスク: 商標ネーミング危険度チェッカー】
入力された商標候補について以下を分析してください。

- technicalField: 指定しようとする商品・役務の区分（ニース分類番号も可）
- problem: 識別力の弱さ・類似商標との混同可能性リスクの概要
- solution: 識別力を高めるための修正案・差別化アプローチ
- components: 商標の構成要素（音・読み・意味・外観・造語性など）
- synonymsAndEnglish: 類似した商標ワード候補・英語表記・読み替えパターン
- riskAssessment: 200文字以内の素人的危険度評価（高/中/低で始めること）
- expertQuestions: 弁理士に確認すべき事項（3〜5件）
- searchKeywords: J-PlatPat商標テキスト検索用キーワード（商標の称呼・外観類似語など）
`.trim(),

  3: `
【タスク: 特許の素人向け翻訳】
入力された特許文書テキスト（クレーム・要約・明細書の一部）を非専門家向けに構造化してください。

- technicalField: 技術分野と想定されるIPC分類（例: G06F）
- problem: 特許が解決しようとしている技術的課題
- solution: 解決手段のポイント（クレーム1を平易に言い換え）
- components: 独立クレームの主要構成要素リスト（技術用語を平易に言い換え）
- synonymsAndEnglish: 専門用語の平易な日本語言い換え・英語表現
- riskAssessment: 200文字以内で権利範囲の広さ・強さの素人的評価
- expertQuestions: 技術者・弁理士に確認すべき事項（3〜5件）
- searchKeywords: J-PlatPat先行技術検索用の日本語・英語キーワード
`.trim(),

  4: `
【タスク: 自社アイデアの先行技術メモ化】
入力されたアイデア・技術構想を先行技術調査のための構造化メモに変換してください。

- technicalField: アイデアが属する技術分野とIPC分類候補
- problem: アイデアが解決しようとしている技術的課題
- solution: アイデアの技術的解決手段（出願クレームのコア要素）
- components: アイデアの主要構成要素・新規性のポイント
- synonymsAndEnglish: 先行技術検索に使える類義語・英語キーワード・IPC分類候補
- riskAssessment: 200文字以内で先行技術との類似リスクの素人的評価
- expertQuestions: 出願前に弁理士へ相談すべき事項（3〜5件）
- searchKeywords: J-PlatPat先行技術検索用キーワード（上位概念・下位概念を含む）
`.trim(),
};

export function buildSystemPrompt(preset: Preset): string {
  const instruction = PRESET_INSTRUCTIONS[preset.id] ?? '';
  return [DISCLAIMER, '', instruction, '', JSON_SCHEMA].join('\n');
}

export function buildUserMessage(preset: Preset, input: string): string {
  const label =
    preset.id === 1
      ? '商標候補'
      : preset.id === 3
        ? '特許文書テキスト'
        : 'アイデア・技術構想';

  return `【${label}】\n${input.trim()}`;
}
