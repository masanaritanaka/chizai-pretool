import Database from '@tauri-apps/plugin-sql';

let _db: Database | null = null;
async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load('sqlite:chizai-pretool.db');
  return _db;
}

// ── 型定義 ─────────────────────────────────────────────────────────────────

export type IdeaStatus = 'draft' | 'researching' | 'consulted' | 'archived';

export interface IdeaMemo {
  id: number;
  title: string;
  rawInput: string;
  memoJson: string;
  memoText: string;
  tags: string;
  lawDomain: string;
  linkedMemoIds: number[];
  status: IdeaStatus;
  notionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaMemoListItem {
  id: number;
  title: string;
  tags: string;
  lawDomain: string;
  status: IdeaStatus;
  notionUrl: string | null;
  updatedAt: string;
}

export interface SavedView {
  id: number;
  name: string;
  filterJson: string;
  createdAt: string;
}

// ── DB行型 (snake_case) ────────────────────────────────────────────────────

interface IdeaMemoRow {
  id: number;
  title: string;
  raw_input: string;
  memo_json: string;
  memo_text: string;
  tags: string;
  law_domain: string;
  linked_memo_ids: string;
  status: string;
  notion_url: string | null;
  created_at: string;
  updated_at: string;
}

interface IdeaMemoListRow {
  id: number;
  title: string;
  tags: string;
  law_domain: string;
  status: string;
  notion_url: string | null;
  updated_at: string;
}

interface SavedViewRow {
  id: number;
  name: string;
  filter_json: string;
  created_at: string;
}

function rowToMemo(r: IdeaMemoRow): IdeaMemo {
  let linkedMemoIds: number[] = [];
  try { linkedMemoIds = JSON.parse(r.linked_memo_ids) as number[]; } catch { /* ignore */ }
  return {
    id: r.id, title: r.title, rawInput: r.raw_input, memoJson: r.memo_json,
    memoText: r.memo_text, tags: r.tags, lawDomain: r.law_domain,
    linkedMemoIds, status: r.status as IdeaStatus,
    notionUrl: r.notion_url, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ── memo_text 生成 ─────────────────────────────────────────────────────────

type KwGroup = { element?: string; terms_ja?: string[]; terms_en?: string[] };

export function memoToText(memoJson: string): string {
  try {
    const m = JSON.parse(memoJson) as Record<string, unknown>;
    const parts: string[] = [];
    const str = (v: unknown) => typeof v === 'string' ? v : '';
    const strArr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

    const known = new Set(['core','noveltyFocus','keyword_groups','alternatives','preConsultChecklist',
      'phoneticsAnalysis','conflictRisk','riskLevel','preFilingActions',
      'niceClasses','distinctiveness','checklist','costEstimate',
      'summary','usageScenes','novelty','termMap','businessQuestions','whenToConsult',
      'visualFeatures','keyElements','articleSimilarity','priorDesignPoints',
      'clauses','negotiationOptions','consultationItems']);

    for (const [k, v] of Object.entries(m)) {
      if (k === 'keyword_groups' && Array.isArray(v)) {
        for (const g of v as KwGroup[]) {
          if (g.element) parts.push(g.element);
          if (g.terms_ja) parts.push(...g.terms_ja.filter(Boolean));
          if (g.terms_en) parts.push(...g.terms_en.filter(Boolean));
        }
      } else if (k === 'termMap' && Array.isArray(v)) {
        for (const row of v as { term?: string; plain?: string }[]) {
          if (row.term) parts.push(row.term);
          if (row.plain) parts.push(row.plain);
        }
      } else if (k === 'clauses' && Array.isArray(v)) {
        for (const c of v as { clause?: string; risk?: string }[]) {
          if (c.clause) parts.push(c.clause);
          if (c.risk) parts.push(c.risk);
        }
      } else if (typeof v === 'string' && known.has(k)) {
        parts.push(v);
      } else if (Array.isArray(v) && known.has(k)) {
        parts.push(...strArr(v));
      } else if (typeof v === 'string') {
        parts.push(str(v));
      }
    }
    return parts.join(' ');
  } catch {
    return '';
  }
}

// ── フィールド構文パーサー ─────────────────────────────────────────────────

interface ParsedQuery {
  status?: string;
  tags?: string[];
  domain?: string;
  updatedAfter?: string;
  freeText?: string;
}

export function parseFieldSyntax(raw: string): ParsedQuery {
  const result: ParsedQuery = {};
  const free: string[] = [];
  for (const part of raw.trim().split(/\s+/)) {
    if (!part) continue;
    if (part.startsWith('status:')) { result.status = part.slice(7); }
    else if (part.startsWith('tag:')) { result.tags = [...(result.tags ?? []), part.slice(4)]; }
    else if (part.startsWith('domain:')) { result.domain = part.slice(7); }
    else if (part.startsWith('updated:>')) { result.updatedAfter = part.slice(9); }
    else { free.push(part); }
  }
  if (free.length > 0) result.freeText = free.join(' ');
  return result;
}

// ── SaveMemoInput / UpdateMemoPatch ────────────────────────────────────────

export interface SaveMemoInput {
  title: string;
  rawInput: string;
  memoJson: string;
  tags?: string;
  lawDomain?: string;
  linkedMemoIds?: number[];
}

export interface UpdateMemoPatch {
  title?: string;
  tags?: string;
  status?: IdeaStatus;
  notionUrl?: string | null;
  lawDomain?: string;
  linkedMemoIds?: number[];
}

// ── FTS ヘルパー ───────────────────────────────────────────────────────────

async function ftsInsert(db: Database, id: number, title: string, rawInput: string, memoText: string, tags: string) {
  await db.execute(
    'INSERT INTO idea_memos_fts(rowid, title, raw_input, memo_text, tags) VALUES (?, ?, ?, ?, ?)',
    [id, title, rawInput, memoText, tags],
  );
}

async function ftsDelete(db: Database, id: number, title: string, rawInput: string, memoText: string, tags: string) {
  await db.execute(
    "INSERT INTO idea_memos_fts(idea_memos_fts, rowid, title, raw_input, memo_text, tags) VALUES('delete', ?, ?, ?, ?, ?)",
    [id, title, rawInput, memoText, tags],
  );
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function saveMemo(input: SaveMemoInput): Promise<number> {
  const db = await getDb();
  const tags = input.tags ?? '';
  const lawDomain = input.lawDomain ?? '';
  const linkedMemoIds = JSON.stringify(input.linkedMemoIds ?? []);
  const memoText = memoToText(input.memoJson);

  const result = await db.execute(
    `INSERT INTO idea_memos (title, raw_input, memo_json, memo_text, tags, law_domain, linked_memo_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.title, input.rawInput, input.memoJson, memoText, tags, lawDomain, linkedMemoIds],
  );
  const id = result.lastInsertId as number;

  await db.execute('BEGIN');
  try {
    await ftsInsert(db, id, input.title, input.rawInput, memoText, tags);
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
  return id;
}

export async function getMemo(id: number): Promise<IdeaMemo | null> {
  const db = await getDb();
  const rows = await db.select<IdeaMemoRow[]>('SELECT * FROM idea_memos WHERE id = ?', [id]);
  return rows.length > 0 ? rowToMemo(rows[0]) : null;
}

export interface ListMemosOptions {
  query?: string;
  status?: string;
  domain?: string;
  tags?: string[];
  updatedAfter?: string;
}

export async function listMemos(options: ListMemosOptions | string = {}, legacyStatus?: string): Promise<IdeaMemoListItem[]> {
  const db = await getDb();

  // backward compat: listMemos(queryString, status) old signature
  let opts: ListMemosOptions;
  if (typeof options === 'string') {
    opts = parseFieldSyntax(options);
    if (legacyStatus && legacyStatus !== 'all') opts.status = legacyStatus;
  } else {
    opts = options;
  }

  const filters: string[] = [];
  const params: unknown[] = [];

  if (opts.status && opts.status !== 'all') {
    filters.push('status = ?');
    params.push(opts.status);
  }
  if (opts.domain) {
    filters.push('law_domain LIKE ?');
    params.push(`%${opts.domain}%`);
  }
  if (opts.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      filters.push('tags LIKE ?');
      params.push(`%${tag}%`);
    }
  }
  if (opts.updatedAfter) {
    filters.push('updated_at > ?');
    params.push(opts.updatedAfter);
  }

  const freeText = opts.freeText ?? (typeof options === 'string' ? undefined : undefined);

  let idFilter = '';
  if (freeText) {
    const ftsIds = new Set<number>();
    try {
      const safeQ = freeText.replace(/["\\]/g, '');
      if (safeQ) {
        const ftsRows = await db.select<{ rowid: number }[]>(
          'SELECT rowid FROM idea_memos_fts WHERE idea_memos_fts MATCH ?',
          [`"${safeQ}"`],
        );
        ftsRows.forEach(r => ftsIds.add(r.rowid));
      }
    } catch { /* FTS syntax error — fall through to LIKE only */ }

    const like = `%${freeText}%`;
    const likeParams: unknown[] = [like, like, like, like, like];
    if (ftsIds.size > 0) {
      idFilter = `(id IN (${[...ftsIds].join(',')}) OR title LIKE ? OR raw_input LIKE ? OR memo_text LIKE ? OR tags LIKE ? OR memo_json LIKE ?)`;
    } else {
      idFilter = '(title LIKE ? OR raw_input LIKE ? OR memo_text LIKE ? OR tags LIKE ? OR memo_json LIKE ?)';
    }
    filters.push(idFilter);
    params.push(...likeParams);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `SELECT id, title, tags, law_domain, status, notion_url, updated_at FROM idea_memos ${where} ORDER BY updated_at DESC`;

  const rows = await db.select<IdeaMemoListRow[]>(sql, params);
  return rows.map(r => ({
    id: r.id, title: r.title, tags: r.tags, lawDomain: r.law_domain,
    status: r.status as IdeaStatus, notionUrl: r.notion_url, updatedAt: r.updated_at,
  }));
}

export async function countMemos(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM idea_memos');
  return rows[0]?.cnt ?? 0;
}

export async function updateMemo(id: number, patch: UpdateMemoPatch): Promise<void> {
  const db = await getDb();
  const current = await getMemo(id);
  if (!current) return;

  const newTitle = patch.title ?? current.title;
  const newTags = patch.tags ?? current.tags;
  const ftsChanged = patch.title !== undefined || patch.tags !== undefined;

  await db.execute('BEGIN');
  try {
    const setParts: string[] = ["updated_at = datetime('now','localtime')"];
    const values: unknown[] = [];
    if (patch.title !== undefined) { setParts.push('title = ?'); values.push(patch.title); }
    if (patch.tags !== undefined) { setParts.push('tags = ?'); values.push(patch.tags); }
    if (patch.status !== undefined) { setParts.push('status = ?'); values.push(patch.status); }
    if (patch.notionUrl !== undefined) { setParts.push('notion_url = ?'); values.push(patch.notionUrl); }
    if (patch.lawDomain !== undefined) { setParts.push('law_domain = ?'); values.push(patch.lawDomain); }
    if (patch.linkedMemoIds !== undefined) { setParts.push('linked_memo_ids = ?'); values.push(JSON.stringify(patch.linkedMemoIds)); }
    values.push(id);

    await db.execute(`UPDATE idea_memos SET ${setParts.join(', ')} WHERE id = ?`, values);

    if (ftsChanged) {
      await ftsDelete(db, id, current.title, current.rawInput, current.memoText, current.tags);
      await ftsInsert(db, id, newTitle, current.rawInput, current.memoText, newTags);
    }

    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
}

export async function deleteMemo(id: number): Promise<void> {
  const db = await getDb();
  const current = await getMemo(id);
  if (!current) return;

  await db.execute('BEGIN');
  try {
    await ftsDelete(db, id, current.title, current.rawInput, current.memoText, current.tags);
    await db.execute('DELETE FROM idea_memos WHERE id = ?', [id]);
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
}

export async function duplicateMemo(id: number): Promise<number> {
  const current = await getMemo(id);
  if (!current) throw new Error('Memo not found');
  return saveMemo({
    title: `${current.title}（コピー）`,
    rawInput: current.rawInput,
    memoJson: current.memoJson,
    tags: current.tags,
    lawDomain: current.lawDomain,
    linkedMemoIds: [],
  });
}

// ── Saved Views CRUD ───────────────────────────────────────────────────────

export async function listSavedViews(): Promise<SavedView[]> {
  const db = await getDb();
  const rows = await db.select<SavedViewRow[]>('SELECT * FROM saved_views ORDER BY name ASC');
  return rows.map(r => ({ id: r.id, name: r.name, filterJson: r.filter_json, createdAt: r.created_at }));
}

export async function saveView(name: string, filterJson: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO saved_views (name, filter_json) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET filter_json = excluded.filter_json',
    [name.trim(), filterJson],
  );
  return result.lastInsertId as number;
}

export async function deleteView(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM saved_views WHERE id = ?', [id]);
}
