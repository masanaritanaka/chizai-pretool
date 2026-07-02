export type WatchLawDomain = '特許' | '商標' | 'both';

export interface WatchTarget {
  id: number;
  name: string;
  lawDomain: WatchLawDomain;
  patentExpression: string | null;
  trademarkExpression: string | null;
  notes: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchTargetInput {
  name: string;
  lawDomain: WatchLawDomain;
  patentExpression: string | null;
  trademarkExpression: string | null;
  notes: string | null;
}

export const LAW_DOMAIN_OPTIONS: { value: WatchLawDomain; label: string }[] = [
  { value: 'both',  label: '特許 + 商標' },
  { value: '特許',   label: '特許のみ' },
  { value: '商標',   label: '商標のみ' },
];

/** PatentMapGenerator が Claude から受け取る JSON の型 */
export interface PatentMapAxis {
  label: string;
  description: string;
  ipc: string;
  patentExpression: string;
  subAxes: { label: string; description: string; patentExpression: string }[];
}

export interface PatentMapResult {
  title: string;
  summary: string;
  axes: PatentMapAxis[];
  expertQuestions: string[];
}
