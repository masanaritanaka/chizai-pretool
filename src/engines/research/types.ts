export interface StructuredMemo {
  technicalField: string;
  problem: string;
  solution: string;
  components: string[];
  synonymsAndEnglish: string[];
  riskAssessment: string;
  expertQuestions: string[];
  searchKeywords: string[];
}

export interface FieldLabels {
  technicalField: string;
  problem: string;
  solution: string;
}

export const FIELD_LABELS: Record<number, FieldLabels> = {
  1: {
    technicalField: '登録したい商品・サービスの種類',
    problem: '問題になりそうな点',
    solution: '区別するためのアプローチ',
  },
  2: {
    technicalField: '商品・サービスの分野（国際分類）',
    problem: '出願が通りにくいリスク',
    solution: '出願前にやるべきこと',
  },
  3: {
    technicalField: '技術の分野と分類の候補',
    problem: '発明が解決しようとしている問題',
    solution: '解決方法のポイント',
  },
  4: {
    technicalField: 'アイデアの技術分野',
    problem: 'アイデアが解決しようとしている問題',
    solution: '技術的な解決方法',
  },
  5: {
    technicalField: '製品カテゴリと意匠分類の候補',
    problem: '他の意匠と似ている可能性のある特徴',
    solution: '全体的な印象の近さ評価',
  },
  9: {
    technicalField: '文書の種類と関係する分野',
    problem: '問題になりそうな条文・表現',
    solution: '修正案・対処のアプローチ',
  },
};
