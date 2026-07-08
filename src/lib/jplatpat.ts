import { open } from '@tauri-apps/plugin-shell';

export type SearchDomain = 'patent' | 'utility-model' | 'trademark' | 'design';

export interface JplatpatLink {
  label: string;
  domain: SearchDomain;
  expression: string;
  url: string;
}

/** 検索式キーワードグループ。構成要素ごとに日本語・英語の同義語を持つ二層構造。 */
export interface KeywordGroup {
  element: string;
  terms_ja: string[];
  terms_en: string[];
}

// 実機確認済みURL (2026-07): /p0100=200, /t0100=200, /d0100=200
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
 * 特許/実用新案/意匠テキスト検索式を生成する。
 * 構成要素グループ内は OR（同義語・上下位概念の代替）、グループ間は AND（異なる構成要素の共起）。
 * 例: (ブレーキ OR 制動装置 OR brake) AND (機械学習 OR AI OR machine learning)
 *
 * 上限: グループ数 4、1グループあたり ja+en 合計 6 語。超過分は重要度優先で切り捨て。
 */
export function buildPatentExpressionFromGroups(groups: KeywordGroup[]): string {
  if (!groups || groups.length === 0) return '';

  const groupExprs: string[] = [];
  for (const group of groups.slice(0, 4)) {
    const terms = [
      ...group.terms_ja.slice(0, 3).map(t => t.trim()).filter(Boolean),
      ...group.terms_en.slice(0, 3).map(t => t.trim()).filter(Boolean),
    ].slice(0, 6);

    if (terms.length === 0) continue;
    groupExprs.push(terms.length === 1 ? `(${terms[0]})` : `(${terms.join(' OR ')})`);
  }

  return groupExprs.join(' AND ');
}

/**
 * 商標テキスト検索式を生成する。
 * 称呼・外観・観念の各バリエーションを OR 連結する（商標類似判断は包括的に行う）。
 * 例: (ナマエ OR NAME OR 名前 OR NAMAE)
 */
export function buildTrademarkExpressionFromGroups(groups: KeywordGroup[]): string {
  if (!groups || groups.length === 0) return '';

  const allTerms: string[] = [];
  for (const group of groups.slice(0, 4)) {
    allTerms.push(...group.terms_ja.slice(0, 3).map(t => t.trim()).filter(Boolean));
    allTerms.push(...group.terms_en.slice(0, 2).map(t => t.trim()).filter(Boolean));
    if (allTerms.length >= 8) break;
  }

  const terms = allTerms.slice(0, 8);
  if (terms.length === 0) return '';
  if (terms.length === 1) return `(${terms[0]})`;
  return `(${terms.join(' OR ')})`;
}

/**
 * プリセットの法域から J-PlatPat リンクを生成する。
 */
export function buildLinks(lawDomains: string[], keywordGroups: KeywordGroup[]): JplatpatLink[] {
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
        ? buildTrademarkExpressionFromGroups(keywordGroups)
        : buildPatentExpressionFromGroups(keywordGroups);

    links.push({ label: DOMAIN_LABELS[sd], domain: sd, expression, url: SEARCH_URLS[sd] });
  }

  return links;
}

/** J-PlatPat をデフォルトブラウザで開く */
export async function openJplatpat(url: string): Promise<void> {
  await open(url);
}
