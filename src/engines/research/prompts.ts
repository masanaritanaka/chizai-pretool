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
- searchKeywords: J-PlatPat商標テキスト検索用キーワード（称呼・外観類似語など）
`.trim(),

  2: `
【タスク: 商標出願前チェックリスト】
入力された商標候補について、出願前の準備事項を網羅的にチェックしてください。

- technicalField: 指定商品・役務の区分（ニース分類）と想定市場
- problem: 出願阻害リスク（類似商標・識別力・記述的表示・公序良俗など）
- solution: 出願可能性を高めるための具体的な修正・準備アクション
- components: 出願前チェックリスト項目（識別力確認・類似調査・区分選択・使用証拠収集など）
- synonymsAndEnglish: 称呼類似・外観類似・観念類似の候補語・英語表記
- riskAssessment: 200文字以内の素人的登録見通し評価（高/中/低で始めること）
- expertQuestions: 弁理士に確認すべき事項（3〜5件）
- searchKeywords: J-PlatPat商標テキスト検索用キーワード
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

  5: `
【タスク: 意匠・UI類似チェック（画像解析）】
アップロードされた画像の意匠（デザイン・UI・外観）を分析し、類似意匠との抵触リスクを評価してください。

- technicalField: 画像の物品カテゴリとロカルノ国際分類（Locarno）の該当クラス候補
- problem: 類似する可能性のある既存意匠の特徴・共通要素
- solution: 形状・配置・全体的印象における近さの評価（非類似と考えられる差異点も）
- components: 特徴的な形状要素・配色・レイアウト・視覚的印象のリスト
- synonymsAndEnglish: 意匠検索用キーワード・ロカルノ分類番号候補・英語表現
- riskAssessment: 200文字以内の素人的類似リスク評価（高/中/低で始めること）
- expertQuestions: 意匠登録・意匠弁理士に確認すべき事項（3〜5件）
- searchKeywords: J-PlatPat意匠テキスト検索用キーワード（物品名・形状語）
`.trim(),

  9: `
【タスク: 契約・提案書の知財リスクチェッカー】
入力された契約書・提案書・仕様書等のテキストから、知財に関わるリスク条項を抽出・評価してください。

- technicalField: 契約・文書の種類と対象分野（例: ソフトウェア開発委託契約）
- problem: 知財リスクのある条項・記述の概要（権利帰属・秘密保持・競業避止・ライセンスなど）
- solution: リスク条項の修正案・対処アプローチ
- components: リスクが懸念される具体的な条項・記述のリスト（引用形式で）
- synonymsAndEnglish: 関連する法的用語・英語表現（知財関連契約用語）
- riskAssessment: 200文字以内の素人的リスク評価（高/中/低で始めること）
- expertQuestions: 弁護士・弁理士に確認すべき事項（3〜5件）
- searchKeywords: 関連先行事例検索用キーワード（任意）
`.trim(),
};

export function buildSystemPrompt(preset: Preset): string {
  const instruction = PRESET_INSTRUCTIONS[preset.id] ?? '';
  return [DISCLAIMER, '', instruction, '', JSON_SCHEMA].join('\n');
}

/** テキスト入力プリセット用のユーザーメッセージを組み立てる */
export function buildUserMessage(preset: Preset, input: string): string {
  const labels: Record<number, string> = {
    1: '商標候補',
    2: '商標候補',
    3: '特許文書テキスト',
    4: 'アイデア・技術構想',
    9: '契約書・提案書テキスト',
  };
  const label = labels[preset.id] ?? '入力テキスト';
  return `【${label}】\n${input.trim()}`;
}

/** Vision プリセット (preset 5) 用のシステムプロンプトを返す */
export function buildVisionSystemPrompt(): string {
  return [DISCLAIMER, '', PRESET_INSTRUCTIONS[5] ?? '', '', JSON_SCHEMA].join('\n');
}

/** Vision プリセット (preset 5) 用のテキストメッセージ部分を返す */
export function buildVisionTextMessage(additionalDescription: string): string {
  const base = '【意匠・UI 画像】\n添付された画像を分析してください。';
  return additionalDescription.trim()
    ? `${base}\n\n【補足情報】\n${additionalDescription.trim()}`
    : base;
}
