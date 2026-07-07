import { open } from '@tauri-apps/plugin-shell';

export type SearchDomain = 'patent' | 'utility-model' | 'trademark' | 'design';

export interface JplatpatLink {
  label: string;
  domain: SearchDomain;
  expression: string;
  url: string;
}

// 実機確認済みURL (2026-07): /p0100=200, /t0100=200, /d0100=200
// 実用新案専用パスは J-PlatPat に存在しないため特許検索 /p0100 を使用
const SEARCH_URLS: Record<SearchDomain, string> = {
  patent: 'https://www.j-platpat.inpit.go.jp/p0100',
  'utility-model': 'https://www.j-platpat.inpit.go.jp/p0100',
  trademark: 'https://www.j-platpat.inpit.go.jp/t0100',
  design: 'https://www.j-platpat.inpit.go.jp/d0100',
};

const DOMAIN_LABELS: Record<SearchDomain, string> = {
  patent: '特許テキスト検索',
  'utility-model': '特許・実用新案テキスト検索',
  trademark: '商標テキスト検索',
  design: '意匠テキスト検索',
};

/**
 * キーワード配列から J-PlatPat 特許/実用新案テキスト検索式を生成する。
 * J-PlatPat 式入力検索の書式: (キーワード1) AND (キーワード2)
 * フィールド指定: /AB=要約, /TI=名称, /CL=クレーム  ※省略時は全文
 */
export function buildPatentExpression(keywords: string[]): string {
  if (keywords.length === 0) return '';
  const terms = keywords.map((kw) => `(${kw.trim()})`);
  return terms.join(' AND ');
}

/**
 * 商標テキスト検索式（商標の名称/称呼をORで並べる）
 */
export function buildTrademarkExpression(keywords: string[]): string {
  if (keywords.length === 0) return '';
  const terms = keywords.map((kw) => `(${kw.trim()})`);
  return terms.join(' OR ');
}

/**
 * プリセットの法域から J-PlatPat リンクを生成する
 */
export function buildLinks(lawDomains: string[], keywords: string[]): JplatpatLink[] {
  const links: JplatpatLink[] = [];

  const domainMap: Record<string, SearchDomain> = {
    特許: 'patent',
    実用新案: 'utility-model',
    商標: 'trademark',
    意匠: 'design',
  };

  const seen = new Set<SearchDomain>();

  for (const domain of lawDomains) {
    const sd = domainMap[domain];
    if (!sd || seen.has(sd)) continue;
    seen.add(sd);

    const expression =
      sd === 'trademark'
        ? buildTrademarkExpression(keywords)
        : buildPatentExpression(keywords);

    links.push({
      label: DOMAIN_LABELS[sd],
      domain: sd,
      expression,
      url: SEARCH_URLS[sd],
    });
  }

  return links;
}

/** J-PlatPat をデフォルトブラウザで開く */
export async function openJplatpat(url: string): Promise<void> {
  await open(url);
}
