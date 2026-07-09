import type { Preset } from '../../home/presets';

const DISCLAIMER = `
あなたは知財初期調査の補助アシスタントです。
【制約】登録可能性・権利侵害の有無を判定・保証しません。法的助言を行いません。
最終判断は必ず弁理士・知財部に委ねるよう促してください。
`.trim();

// ── keyword_groups の共通注意書き ─────────────────────────────────────────────
const KW_NOTE = `
【keyword_groups の注意事項】
- グループ数は最大4。新規性の焦点に直結する構成要素のみに絞る。全構成要素の機械的列挙禁止。
- 1グループあたり terms_ja は最大3語、terms_en は最大3語（合計6語以内）。
- terms_ja・terms_en は必ずスペースを含まない1単語のみ。複合概念は1語に要約すること。
  例: "cutting board" は不可 → "board" または "manaita" 等の1語を選ぶ。
  "machine learning" は不可 → "learning" または "machinelearning" ではなく "detection" 等の概念核心語。
- J-PlatPat 検索文字数制限を考慮し、概念の核心を表す語のみを選ぶ。
`.trim();

// ── keyword_groups JSONスキーマ断片 ───────────────────────────────────────────
const KW_SCHEMA = `"keyword_groups": [
    {
      "element": "string（新規性の焦点に直結する構成要素名のみ。機械的な全列挙禁止）",
      "terms_ja": ["string（日本語キーワード、最大3語）"],
      "terms_en": ["string（英語キーワード、最大3語）"]
    }
  ]`;

// ════════════════════════════════════════════════════════════════════════════
// Preset 01: 商標ネーミング危険度チェッカー
// ════════════════════════════════════════════════════════════════════════════
const P01_INSTRUCTION = `
【タスク: 商標ネーミング危険度チェッカー】
入力された商標候補について、命名段階での事前リスクを確認してください。

- phoneticsAnalysis: 称呼（読み・音）・外観（文字の形）・観念（意味・イメージ）の3方向から特徴を分析
- conflictRisk: 既登録商標との類似可能性がある観点（よく似た音・見た目・意味を持つ語の傾向）
- riskLevel: 「高：○○の理由で〜」「中：○○の点で〜」「低：○○なので〜」の形式で200字以内
- preFilingActions: 出願前に確認すべき具体的アクション（3〜5項目）
- keyword_groups: J-PlatPat 商標テキスト検索用キーワードグループ（称呼バリエーション・外観類似語など）

${KW_NOTE}
`.trim();

const P01_SCHEMA = `
出力は以下の JSON スキーマに厳密に従ってください。JSON 以外の文字（マークダウン記号・コードブロック等）を含めないこと。

{
  "phoneticsAnalysis": "string",
  "conflictRisk": "string",
  "riskLevel": "string（高/中/低で始める）",
  "preFilingActions": ["string"],
  ${KW_SCHEMA}
}
`.trim();

// ════════════════════════════════════════════════════════════════════════════
// Preset 02: 商標出願前チェックリスト
// ════════════════════════════════════════════════════════════════════════════
const P02_INSTRUCTION = `
【タスク: 商標出願前チェックリスト】
入力された商標候補について、出願直前の確認事項を網羅的にまとめてください。

- niceClasses: 指定商品・役務のニース分類候補（番号と名称を含めて）
- distinctiveness: 識別力の確認ポイント（記述的表示・普通名称・公序良俗など）
- checklist: 出願前チェックリスト（UIで☑として表示。「〜を確認した」「〜を用意した」の形式で6〜10項目）
- costEstimate: 費用・期間の目安（出願料目安、審査期間の一般的な見通し）
- keyword_groups: J-PlatPat 商標テキスト検索用キーワードグループ（出願前調査用）

${KW_NOTE}
`.trim();

const P02_SCHEMA = `
出力は以下の JSON スキーマに厳密に従ってください。JSON 以外の文字（マークダウン記号・コードブロック等）を含めないこと。

{
  "niceClasses": "string",
  "distinctiveness": "string",
  "checklist": ["string（「〜を確認した」「〜を用意した」形式の項目）"],
  "costEstimate": "string",
  ${KW_SCHEMA}
}
`.trim();

// ════════════════════════════════════════════════════════════════════════════
// Preset 03: 特許文書をやさしく読み解く (刷新済み・変更しない)
// ════════════════════════════════════════════════════════════════════════════
const P03_INSTRUCTION = `
【タスク: 特許文書をやさしく読み解く】
入力された特許文書テキスト（保護範囲の記述・要約・明細書の一部）を、知財の専門知識がない事業担当者・エンジニアが理解できるように解説してください。

【出力の注意事項】
- 「クレーム」「請求項」などの専門語を使う場合は必ず平易語を並記する（例: 「保護範囲(クレーム)」）
- 「均等論」「新規性」「進歩性」などの法律・審査用語は使わない
- 各項目は結論から書き始める。前置き・導入文で始めない

- summary: この特許が「何を」「どうやって」「何のために」実現するものか、専門用語なしの2〜3文で完結させること
- usageScenes: 実生活・実務での想像しやすい適用シーン。具体的な製品・作業・状況を例示すること
- novelty: 「これまではこうだった / この特許ではこう変わった」の対比で平易に説明
- termMap: 文書中の重要語を「原文語 → 平易な言い換え」として5〜8語
- businessQuestions: 「自社との関係」「回避・差別化の余地」「ライセンス・協業の可能性」の3観点で各1〜2文
- whenToConsult: 「もし〜なら相談を検討」の形式で3項目以内
`.trim();

const P03_SCHEMA = `
出力は以下の JSON スキーマに厳密に従ってください。JSON 以外の文字（マークダウン記号・コードブロック等）を含めないこと。

{
  "summary": "string（2〜3文、専門用語なし）",
  "usageScenes": "string（実生活・実務での適用シーン）",
  "novelty": "string（従来との違い・技術的優位性を平易に）",
  "termMap": [{"term": "原文語（string）", "plain": "平易な言い換え（string）"}],
  "businessQuestions": ["観点1（string）", "観点2（string）", "観点3（string）"],
  "whenToConsult": ["もし〜なら相談を検討（string、3項目以内）"]
}
`.trim();

// ════════════════════════════════════════════════════════════════════════════
// Preset 04: アイデアの先行調査メモ
// ════════════════════════════════════════════════════════════════════════════
const P04_INSTRUCTION = `
【タスク: 自社アイデアの先行技術メモ化】
入力されたアイデア・技術構想を先行技術調査のための構造化メモに変換してください。

【出力の注意事項】
- 「core」は「何を（対象）・どうやって（手段）・誰のために（目的）」の3要素を含む1〜2文
- 「noveltyFocus」は「これまでは〜／このアイデアでは〜」の対比形式が望ましい
- 「keyword_groups」は構成要素ごとに分け、各グループで日本語・英語の検索語を提示
- 「alternatives」は出願クレーム設計・回避設計・差別化の視点で2〜3案
- 「preConsultChecklist」は弁理士相談前に自分で確認しておくべき事項（先行技術調査のヒント含む）

${KW_NOTE}
`.trim();

const P04_SCHEMA = `
出力は以下の JSON スキーマに厳密に従ってください。JSON 以外の文字（マークダウン記号・コードブロック等）を含めないこと。

{
  "core": "string（アイデアの核: 何を・どうやって・誰のために実現するか、1〜2文）",
  "noveltyFocus": "string（新規性の焦点: 既存技術・製品との違いを1〜3点で端的に）",
  ${KW_SCHEMA},
  "alternatives": ["string（差別化・回避設計の選択肢、2〜3案）"],
  "preConsultChecklist": ["string（弁理士相談前チェックリスト、3〜5項目）"]
}
`.trim();

// ════════════════════════════════════════════════════════════════════════════
// Preset 05: 意匠・UI類似チェック（画像入力）
// ════════════════════════════════════════════════════════════════════════════
const P05_INSTRUCTION = `
【タスク: 意匠・UI類似チェック（画像解析）】
アップロードされた画像の意匠（デザイン・UI・外観）を分析し、類似意匠との抵触リスクを評価してください。

- visualFeatures: 形状・模様・色彩の特徴を視覚的に分解（外観要素を具体的に）
- keyElements: 類似判断の観点となる要部（最も印象に残る特徴的部分の特定と評価）
- articleSimilarity: 物品の類否（どの物品カテゴリに属するか、類似する物品の範囲）
- priorDesignPoints: 先行意匠を検索する際に注目すべき観点（3〜5点）
- keyword_groups: J-PlatPat 意匠テキスト検索用キーワードグループ（物品名・形状語）

${KW_NOTE}
`.trim();

const P05_SCHEMA = `
出力は以下の JSON スキーマに厳密に従ってください。JSON 以外の文字（マークダウン記号・コードブロック等）を含めないこと。

{
  "visualFeatures": "string",
  "keyElements": "string",
  "articleSimilarity": "string",
  "priorDesignPoints": ["string（3〜5点）"],
  ${KW_SCHEMA}
}
`.trim();

// ════════════════════════════════════════════════════════════════════════════
// Preset 09: 契約・提案書の知財リスクチェッカー（検索式なし）
// ════════════════════════════════════════════════════════════════════════════
const P09_INSTRUCTION = `
【タスク: 契約・提案書の知財リスクチェッカー】
入力された契約書・提案書・仕様書等のテキストから、知財に関わるリスク条項を抽出・評価してください。

- clauses: 知財関連条項の抽出と所在
  - clause: 条項番号または名称（例: 「第5条（成果物の権利帰属）」）
  - location: 条項が含まれるページや箇所の説明
  - risk: その条項の自社にとってのリスク（具体的に。「自社に不利な理由」を明示）
- negotiationOptions: 修正交渉の選択肢（条項ごとではなく全体の交渉アプローチとして2〜4案）
- consultationItems: 弁理士・弁護士に相談すべき条項・事項（具体的な条番号・内容を示して3〜5項目）

【注意】本タスクは契約レビューのため、特許検索キーワード（keyword_groups）は不要です。
`.trim();

const P09_SCHEMA = `
出力は以下の JSON スキーマに厳密に従ってください。JSON 以外の文字（マークダウン記号・コードブロック等）を含めないこと。

{
  "clauses": [
    {
      "clause": "string（条項番号または名称）",
      "location": "string（文書内の所在）",
      "risk": "string（自社にとってのリスク）"
    }
  ],
  "negotiationOptions": ["string（交渉の選択肢）"],
  "consultationItems": ["string（弁理士・弁護士に相談すべき事項）"]
}
`.trim();

// ── buildSystemPrompt ──────────────────────────────────────────────────────

const SCHEMAS: Record<number, string> = {
  1: P01_SCHEMA,
  2: P02_SCHEMA,
  3: P03_SCHEMA,
  4: P04_SCHEMA,
  5: P05_SCHEMA,
  9: P09_SCHEMA,
};

const INSTRUCTIONS: Record<number, string> = {
  1: P01_INSTRUCTION,
  2: P02_INSTRUCTION,
  3: P03_INSTRUCTION,
  4: P04_INSTRUCTION,
  5: P05_INSTRUCTION,
  9: P09_INSTRUCTION,
};

export function buildSystemPrompt(preset: Preset): string {
  const instruction = INSTRUCTIONS[preset.id] ?? '';
  const schema = SCHEMAS[preset.id] ?? '';
  return [DISCLAIMER, '', instruction, '', schema].join('\n');
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
  return [DISCLAIMER, '', P05_INSTRUCTION, '', P05_SCHEMA].join('\n');
}

/** Vision プリセット (preset 5) 用のテキストメッセージ部分を返す */
export function buildVisionTextMessage(additionalDescription: string): string {
  const base = '【意匠・UI 画像】\n添付された画像を分析してください。';
  return additionalDescription.trim()
    ? `${base}\n\n【補足情報】\n${additionalDescription.trim()}`
    : base;
}
