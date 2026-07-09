import { open } from '@tauri-apps/plugin-shell';

export type SearchDomain = 'patent' | 'utility-model' | 'trademark' | 'design';

export interface JplatpatLink {
  label: string;
  domain: SearchDomain;
  /** 論理式 (特許/実用/意匠) or スペース区切り語列 (商標・選択入力用) */
  expression: string;
  /** 'formula' = 論理式入力タブ向け / 'selection' = 選択入力タブ向け */
  expressionType: 'formula' | 'selection';
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
 * J-PlatPat 論理式に安全に使えるかチェック。
 * スペース・論理演算子・括弧・スラッシュを含む語は除外する。
 * 全角スペースも除外。
 */
function isSafeTerm(term: string): boolean {
  const t = term.trim();
  if (t.length === 0) return false;
  // スペース（半角・全角）含む語は論理式に使えない
  if (/[\s　]/.test(t)) return false;
  // 論理式演算子・括弧・スラッシュを含む語もスキップ
  if (/[+*\-()[\]/]/.test(t)) return false;
  return true;
}

/**
 * 特許・実用新案・意匠テキスト検索用の論理式を生成する。
 *
 * 実機検証済み構文 (2026-07-09, 国内110件確認):
 *   (term1/TX+term2/TX+term3/TX)*(term4/TX+term5/TX)*...
 *
 * ルール:
 * - 各termに /TX を付与（全文検索フィールド）
 * - グループ内 OR → + 連結
 * - グループ間 AND → * 連結
 * - 1グループ = () で囲む
 * - スペース含むtermはスキップ（防御）
 * - 上限: グループ数4、1グループあたり ja3+en3=6語
 */
export function buildPatentExpressionFromGroups(groups: KeywordGroup[]): string {
  if (!groups || groups.length === 0) return '';

  const groupExprs: string[] = [];
  for (const group of groups.slice(0, 4)) {
    const terms = [
      ...group.terms_ja.slice(0, 3).map(t => t.trim()).filter(isSafeTerm),
      ...group.terms_en.slice(0, 3).map(t => t.trim()).filter(isSafeTerm),
    ].slice(0, 6);

    if (terms.length === 0) continue;
    if (terms.length === 1) {
      groupExprs.push(`${terms[0]}/TX`);
    } else {
      groupExprs.push(`(${terms.map(t => `${t}/TX`).join('+')})`);
    }
  }

  return groupExprs.join('*');
}

/**
 * 商標テキスト検索向けのキーワード語列を生成する。
 *
 * 商標検索のフィールドコード仕様は公開ヘルプで確認できないため、
 * 論理式ではなく「選択入力モード（キーワード欄 = OR, 欄間 = AND）向け語列」を出力する。
 * ユーザーは J-PlatPat 商標テキスト検索の「選択入力」タブにペーストしてください。
 */
export function buildTrademarkKeywords(groups: KeywordGroup[]): string {
  const allTerms: string[] = [];
  for (const group of groups.slice(0, 4)) {
    allTerms.push(...group.terms_ja.slice(0, 3).map(t => t.trim()).filter(isSafeTerm));
    allTerms.push(...group.terms_en.slice(0, 2).map(t => t.trim()).filter(isSafeTerm));
    if (allTerms.length >= 8) break;
  }
  return allTerms.slice(0, 8).join(' ');
}

/**
 * 各グループのtermsをスペース区切りで返す。
 * J-PlatPat「選択入力」モードのキーワード欄に1行ずつ貼り付ける用。
 */
export function getGroupLines(groups: KeywordGroup[]): { element: string; terms: string }[] {
  return groups.slice(0, 4).map(g => {
    const terms = [
      ...g.terms_ja.slice(0, 3).map(t => t.trim()).filter(isSafeTerm),
      ...g.terms_en.slice(0, 3).map(t => t.trim()).filter(isSafeTerm),
    ].slice(0, 6);
    return { element: g.element, terms: terms.join(' ') };
  }).filter(g => g.terms.length > 0);
}

/**
 * プリセットの法域から J-PlatPat リンクを生成する。
 * 特許/実用/意匠 → 論理式 ('formula')
 * 商標           → 選択入力用語列 ('selection')
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

    if (sd === 'trademark') {
      const expression = buildTrademarkKeywords(keywordGroups);
      links.push({
        label: DOMAIN_LABELS[sd], domain: sd,
        expression, expressionType: 'selection',
        url: SEARCH_URLS[sd],
      });
    } else {
      const expression = buildPatentExpressionFromGroups(keywordGroups);
      links.push({
        label: DOMAIN_LABELS[sd], domain: sd,
        expression, expressionType: 'formula',
        url: SEARCH_URLS[sd],
      });
    }
  }

  return links;
}

/** J-PlatPat をデフォルトブラウザで開く */
export async function openJplatpat(url: string): Promise<void> {
  await open(url);
}
