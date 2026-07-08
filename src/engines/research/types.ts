import type { KeywordGroup } from '../../lib/jplatpat';

// Re-export so callers can import from one place
export type { KeywordGroup };

// ── 共通 (後方互換) ──────────────────────────────────────────────────────────
export interface StructuredMemo {
  technicalField: string;
  problem: string;
  solution: string;
  components: string[];
  synonymsAndEnglish: string[];
  riskAssessment: string;
  expertQuestions: string[];
  keyword_groups: KeywordGroup[];
}

// ── Preset 01: 商標ネーミング危険度チェッカー ──────────────────────────────────
export interface TrademarkNamingMemo {
  /** 称呼・外観・観念の分析 */
  phoneticsAnalysis: string;
  /** 類似の可能性がある既登録商標の観点 */
  conflictRisk: string;
  /** リスクの目安（高/中/低で始まる） */
  riskLevel: string;
  /** 出願前に確認すべきこと（3〜5項目） */
  preFilingActions: string[];
  /** 商標テキスト検索用グループ */
  keyword_groups: KeywordGroup[];
}

// ── Preset 02: 商標出願前チェックリスト ──────────────────────────────────────
export interface PreFilingCheckMemo {
  /** 指定商品・役務の区分候補（ニース分類） */
  niceClasses: string;
  /** 識別力の確認ポイント */
  distinctiveness: string;
  /** 出願前チェックリスト（☑ 形式で表示するアイテム） */
  checklist: string[];
  /** 費用・期間の目安 */
  costEstimate: string;
  /** 商標テキスト検索用グループ */
  keyword_groups: KeywordGroup[];
}

// ── Preset 03: 特許文書をやさしく読み解く (変更しない) ────────────────────────
export interface PatentReadMemo {
  summary: string;
  usageScenes: string;
  novelty: string;
  termMap: { term: string; plain: string }[];
  businessQuestions: string[];
  whenToConsult: string[];
}

// ── Preset 04: アイデアの先行調査メモ ────────────────────────────────────────
export interface IdeaMemo04Output {
  /** アイデアの核 — 何を・どうやって・誰のために (1〜2文) */
  core: string;
  /** 新規性の焦点 — 既存との違い (1〜3点) */
  noveltyFocus: string;
  /** 先行調査キーワードグループ */
  keyword_groups: KeywordGroup[];
  /** 差別化・回避設計の選択肢 (2〜3案) */
  alternatives: string[];
  /** 弁理士相談前チェックリスト (3〜5項目) */
  preConsultChecklist: string[];
}

// ── Preset 05: 意匠・UI類似チェック ──────────────────────────────────────────
export interface DesignSimilarityMemo {
  /** 形状・模様・色彩の特徴分解 */
  visualFeatures: string;
  /** 類似判断の観点（要部の特定） */
  keyElements: string;
  /** 物品の類否 */
  articleSimilarity: string;
  /** 確認すべき先行意匠の観点（3〜5点） */
  priorDesignPoints: string[];
  /** 意匠テキスト検索用グループ */
  keyword_groups: KeywordGroup[];
}

// ── Preset 09: 契約・提案書の知財リスクチェッカー (検索式なし) ──────────────────
export interface ContractRiskMemo {
  /** 知財関連条項の抽出と所在 */
  clauses: { clause: string; location: string; risk: string }[];
  /** 修正交渉の選択肢 */
  negotiationOptions: string[];
  /** 弁理士・弁護士に相談すべき条項 */
  consultationItems: string[];
}

// ── フィールドラベル（ResearchPage 汎用メモ用 — 使用頻度低下中） ────────────────
export interface FieldLabels {
  technicalField: string;
  problem: string;
  solution: string;
}

export const FIELD_LABELS: Record<number, FieldLabels> = {
  1: { technicalField: '登録したい商品・サービスの種類', problem: '問題になりそうな点', solution: '区別するためのアプローチ' },
  2: { technicalField: '商品・サービスの分野（国際分類）', problem: '出願が通りにくいリスク', solution: '出願前にやるべきこと' },
  4: { technicalField: 'アイデアの技術分野', problem: 'アイデアが解決しようとしている問題', solution: '技術的な解決方法' },
  5: { technicalField: '製品カテゴリと意匠分類の候補', problem: '他の意匠と似ている可能性のある特徴', solution: '全体的な印象の近さ評価' },
  9: { technicalField: '文書の種類と関係する分野', problem: '問題になりそうな条文・表現', solution: '修正案・対処のアプローチ' },
};
