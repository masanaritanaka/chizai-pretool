export type Cluster = '調べる' | '監視する' | '管理する';

export type Engine = 'research' | 'research-vision' | 'watch' | 'manage';

export type InputType = 'text' | 'patent-number-or-text' | 'image' | 'text-with-file' | 'crud';

export type ImageMode = 'vision' | 'ocr' | 'none';

export interface Preset {
  id: number;
  key: string;
  /** ホーム画面に表示するカード名（一般向け） */
  label: string;
  /** マウスオーバーで表示するツールチップ説明 */
  description: string;
  cluster: Cluster;
  engine: Engine;
  lawDomains: string[];
  inputType: InputType;
  outputTemplate: string;
  photoKeyword: string;
  imageMode: ImageMode;
  phase: 1 | 2 | 3 | 4;
}

export const presets: Preset[] = [
  {
    id: 1,
    key: 'trademark-risk-checker',
    label: '社名・商品名が使えるか調べる',
    description: '新しい社名・ブランド名・商品名が、すでに商標として登録されていないかをAIが素早く確認します。弁理士への相談前の一次チェックに最適です。',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['商標'],
    inputType: 'text',
    outputTemplate: 'trademark-risk',
    photoKeyword: 'trademark stamp',
    imageMode: 'ocr',
    phase: 1,
  },
  {
    id: 2,
    key: 'trademark-application-checklist',
    label: '商標出願前の確認リスト',
    description: '商標を出願する前に確認すべきポイントをリスト化します。準備不足で出願が通らないリスクを事前に減らせます。',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['商標'],
    inputType: 'text',
    outputTemplate: 'trademark-checklist',
    photoKeyword: 'checklist paper',
    imageMode: 'ocr',
    phase: 3,
  },
  {
    id: 3,
    key: 'patent-plain-translation',
    label: '特許文書をやさしく読み解く',
    description: '難解な特許文書を、専門知識がなくても理解できる言葉で説明します。競合他社の特許を読み解く際にも役立ちます。',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['特許', '実用新案'],
    inputType: 'patent-number-or-text',
    outputTemplate: 'patent-plain-translation',
    photoKeyword: 'technical blueprint',
    imageMode: 'ocr',
    phase: 1,
  },
  {
    id: 4,
    key: 'prior-art-memo',
    label: 'アイデアの先行調査メモを作る',
    description: '自社のアイデアがすでに誰かに出願されていないか調べるためのキーワード・検索式をAIが作成します。社内整理用のメモとしても使えます。',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['特許', '実用新案'],
    inputType: 'text',
    outputTemplate: 'prior-art-memo',
    photoKeyword: 'notebook sketch',
    imageMode: 'ocr',
    phase: 1,
  },
  {
    id: 5,
    key: 'design-ui-similarity-check',
    label: 'デザイン・画面の類似チェック',
    description: '自社のデザインやアプリ画面の画像をアップロードして、他社の意匠権と似ていないか確認するための観点をAIが整理します。',
    cluster: '調べる',
    engine: 'research-vision',
    lawDomains: ['意匠'],
    inputType: 'image',
    outputTemplate: 'design-similarity',
    photoKeyword: 'interface screens',
    imageMode: 'vision',
    phase: 3,
  },
  {
    id: 9,
    key: 'contract-ip-risk-checker',
    label: '契約書・提案書の知財リスク確認',
    description: '契約書・提案書に含まれる知財上の問題点（権利の帰属・秘密保持・ライセンスなど）をAIが洗い出します。PDFや画像ファイルのドロップにも対応。',
    cluster: '調べる',
    engine: 'research',
    lawDomains: ['契約', '商標', '特許', '意匠'],
    inputType: 'text-with-file',
    outputTemplate: 'contract-ip-risk',
    photoKeyword: 'contract signing',
    imageMode: 'ocr',
    phase: 3,
  },
  {
    id: 7,
    key: 'competitor-ip-watcher',
    label: '競合他社の出願状況を監視する',
    description: '競合企業や技術分野の新しい出願を定期的にチェックするための検索式を管理します。登録した検索式でJ-PlatPatをすぐに開けます。',
    cluster: '監視する',
    engine: 'watch',
    lawDomains: ['特許', '商標'],
    inputType: 'text',
    outputTemplate: 'watch-query',
    photoKeyword: 'binoculars city',
    imageMode: 'none',
    phase: 4,
  },
  {
    id: 8,
    key: 'patent-map-generator',
    label: 'テーマ別 特許マップを作る',
    description: 'あるテーマに関する特許を技術軸・出願者軸などで整理し、競合の全体像が見えるマップをAIが作成します。',
    cluster: '監視する',
    engine: 'watch',
    lawDomains: ['特許'],
    inputType: 'text',
    outputTemplate: 'patent-map-query',
    photoKeyword: 'network data',
    imageMode: 'none',
    phase: 4,
  },
  {
    id: 6,
    key: 'ip-deadline-manager',
    label: '出願・更新の期限を管理する',
    description: '出願日・審査請求期限・年金納付期限などをローカルのPCに記録し、期限が近づいたら通知します。インターネット不要で使えます。',
    cluster: '管理する',
    engine: 'manage',
    lawDomains: ['特許', '実用新案', '意匠', '商標'],
    inputType: 'crud',
    outputTemplate: 'deadline-manager',
    photoKeyword: 'calendar desk',
    imageMode: 'none',
    phase: 2,
  },
  {
    id: 10,
    key: 'defensive-publication-memo',
    label: 'アイデアを記録して権利を守る',
    description: 'アイデアを日付付きで記録することで、後から第三者が同じアイデアで特許を取ることを防げます（防衛公開）。アイデアの証拠を残す用途にも使えます。',
    cluster: '管理する',
    engine: 'manage',
    lawDomains: ['特許', '実用新案'],
    inputType: 'crud',
    outputTemplate: 'defensive-publication',
    photoKeyword: 'archive shelf',
    imageMode: 'none',
    phase: 2,
  },
];

export const clusters: Cluster[] = ['調べる', '監視する', '管理する'];

export const clusterColor: Record<Cluster, string> = {
  '調べる':  '#4F46E5',
  '監視する': '#C2740C',
  '管理する': '#475569',
};

export function presetsByCluster(cluster: Cluster): Preset[] {
  return presets.filter((p) => p.cluster === cluster).sort((a, b) => a.id - b.id);
}

export function photoPath(id: number): string {
  return `/photos/${String(id).padStart(2, '0')}.jpg`;
}
