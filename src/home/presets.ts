export type Cluster = '調べる' | '監視する' | '管理する';

export type Engine = 'research' | 'research-vision' | 'watch' | 'manage';

export type InputType = 'text' | 'patent-number-or-text' | 'image' | 'text-with-file' | 'crud';

export interface Preset {
  id: number;
  key: string;
  label: string;
  cluster: Cluster;
  engine: Engine;
  lawDomains: string[];
  inputType: InputType;
  outputTemplate: string;
  /** Pexels 検索キーワード（scripts/fetch-photos.ts で使用） */
  photoKeyword: string;
  /** §9 の段階的実装計画でこの preset が完成する Phase */
  phase: 1 | 2 | 3 | 4;
}

export const presets: Preset[] = [
  {
    id: 1,
    key: 'trademark-risk-checker',
    label: '商標ネーミング危険度チェッカー',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['商標'],
    inputType: 'text',
    outputTemplate: 'trademark-risk',
    photoKeyword: 'trademark stamp',
    phase: 1,
  },
  {
    id: 2,
    key: 'trademark-application-checklist',
    label: '商標出願前チェックリスト',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['商標'],
    inputType: 'text',
    outputTemplate: 'trademark-checklist',
    photoKeyword: 'checklist paper',
    phase: 3,
  },
  {
    id: 3,
    key: 'patent-plain-translation',
    label: '特許の素人向け翻訳',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['特許', '実用新案'],
    inputType: 'patent-number-or-text',
    outputTemplate: 'patent-plain-translation',
    photoKeyword: 'technical blueprint',
    phase: 1,
  },
  {
    id: 4,
    key: 'prior-art-memo',
    label: '自社アイデアの先行技術メモ化',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['特許', '実用新案'],
    inputType: 'text',
    outputTemplate: 'prior-art-memo',
    photoKeyword: 'notebook sketch',
    phase: 1,
  },
  {
    id: 5,
    key: 'design-ui-similarity-check',
    label: '意匠・UI類似チェック（画像入力）',
    cluster: '調べる',
    engine: 'research-vision',
    lawDomains: ['意匠'],
    inputType: 'image',
    outputTemplate: 'design-similarity',
    photoKeyword: 'interface screens',
    phase: 3,
  },
  {
    id: 9,
    key: 'contract-ip-risk-checker',
    label: '契約・提案書の知財リスクチェッカー',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['契約', '商標', '特許', '意匠'],
    inputType: 'text-with-file',
    outputTemplate: 'contract-ip-risk',
    photoKeyword: 'contract signing',
    phase: 3,
  },
  {
    id: 7,
    key: 'competitor-ip-watcher',
    label: '競合知財ウォッチャー',
    cluster: '監視する',
    engine: 'watch',
    lawDomains: ['特許', '商標'],
    inputType: 'text',
    outputTemplate: 'watch-query',
    photoKeyword: 'binoculars city',
    phase: 4,
  },
  {
    id: 8,
    key: 'patent-map-generator',
    label: '特許マップ自動生成',
    cluster: '監視する',
    engine: 'watch',
    lawDomains: ['特許'],
    inputType: 'text',
    outputTemplate: 'patent-map-query',
    photoKeyword: 'network data',
    phase: 4,
  },
  {
    id: 6,
    key: 'ip-deadline-manager',
    label: '知財期限・ステータス管理',
    cluster: '管理する',
    engine: 'manage',
    lawDomains: ['特許', '実用新案', '意匠', '商標'],
    inputType: 'crud',
    outputTemplate: 'deadline-manager',
    photoKeyword: 'calendar desk',
    phase: 2,
  },
  {
    id: 10,
    key: 'defensive-publication-memo',
    label: '防衛公開メモ',
    cluster: '管理する',
    engine: 'manage',
    lawDomains: ['特許', '実用新案'],
    inputType: 'crud',
    outputTemplate: 'defensive-publication',
    photoKeyword: 'archive shelf',
    phase: 2,
  },
];

export const clusters: Cluster[] = ['調べる', '監視する', '管理する'];

export const clusterColor: Record<Cluster, string> = {
  '調べる':  '#4F46E5', // indigo
  '監視する': '#C2740C', // amber
  '管理する': '#475569', // slate
};

export function presetsByCluster(cluster: Cluster): Preset[] {
  return presets.filter((p) => p.cluster === cluster).sort((a, b) => a.id - b.id);
}

/** /photos/{id:02d}.jpg のURLを返す（public/photos/ → Viteが / にマウント） */
export function photoPath(id: number): string {
  return `/photos/${String(id).padStart(2, '0')}.jpg`;
}
