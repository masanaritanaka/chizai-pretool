export interface StructuredMemo {
  /** 技術分野 / 商品・役務分野 */
  technicalField: string;
  /** 課題 / リスクの概要 */
  problem: string;
  /** 解決手段 / 識別力の評価 */
  solution: string;
  /** 構成要素（箇条書き） */
  components: string[];
  /** 類似語・英語表現・キーワード展開 */
  synonymsAndEnglish: string[];
  /** 危険度所感（素人的評価） */
  riskAssessment: string;
  /** 専門家確認事項 */
  expertQuestions: string[];
  /** J-PlatPat 検索用キーワード */
  searchKeywords: string[];
}

/** プリセットごとのフィールド表示名 */
export interface FieldLabels {
  technicalField: string;
  problem: string;
  solution: string;
}

export const FIELD_LABELS: Record<number, FieldLabels> = {
  1: {
    technicalField: '商品・役務の区分',
    problem: '混同可能性・識別力の課題',
    solution: '差別化のアプローチ',
  },
  2: {
    technicalField: '商品・役務の区分（ニース分類）',
    problem: '出願阻害リスク',
    solution: '修正・準備アクション',
  },
  3: {
    technicalField: '技術分野・IPC分類候補',
    problem: '発明が解決する課題',
    solution: '解決手段（クレーム要約）',
  },
  4: {
    technicalField: 'アイデアの技術分野',
    problem: 'アイデアが解決する課題',
    solution: '技術的解決手段',
  },
  5: {
    technicalField: '物品カテゴリ・ロカルノ分類候補',
    problem: '類似する可能性のある意匠の特徴',
    solution: '形状・配置・全体的印象の近さの評価',
  },
  9: {
    technicalField: '契約・文書の種類と対象分野',
    problem: '知財リスクのある条項・記述',
    solution: 'リスク条項の修正案・対処アプローチ',
  },
};
