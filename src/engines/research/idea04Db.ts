import Database from '@tauri-apps/plugin-sql';

let _db: Database | null = null;
async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load('sqlite:chizai-pretool.db');
  return _db;
}

export type IdeaStatus = 'draft' | 'researching' | 'consulted' | 'archived';

export interface IdeaMemo {
  id: number;
  title: string;
  rawInput: string;
  memoJson: string;
  tags: string;
  status: IdeaStatus;
  notionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaMemoListItem {
  id: number;
  title: string;
  tags: string;
  status: IdeaStatus;
  notionUrl: string | null;
  updatedAt: string;
}

interface IdeaMemoRow {
  id: number;
  title: string;
  raw_input: string;
  memo_json: string;
  tags: string;
  status: string;
  notion_url: string | null;
  created_at: string;
  updated_at: string;
}

interface IdeaMemoListRow {
  id: number;
  title: string;
  tags: string;
  status: string;
  notion_url: string | null;
  updated_at: string;
}

function rowToMemo(r: IdeaMemoRow): IdeaMemo {
  return {
    id: r.id,
    title: r.title,
    rawInput: r.raw_input,
    memoJson: r.memo_json,
    tags: r.tags,
    status: r.status as IdeaStatus,
    notionUrl: r.notion_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface SaveMemoInput {
  title: string;
  rawInput: string;
  memoJson: string;
  tags?: string;
}

export interface UpdateMemoPatch {
  title?: string;
  tags?: string;
  status?: IdeaStatus;
  notionUrl?: string | null;
}

export async function saveMemo(input: SaveMemoInput): Promise<number> {
  const db = await getDb();
  const tags = input.tags ?? '';
  const result = await db.execute(
    `INSERT INTO idea_memos (title, raw_input, memo_json, tags)
     VALUES (?, ?, ?, ?)`,
    [input.title, input.rawInput, input.memoJson, tags],
  );
  const id = result.lastInsertId as number;
  await db.execute(
    'INSERT INTO idea_memos_fts(rowid, title, tags) VALUES (?, ?, ?)',
    [id, input.title, tags],
  );
  return id;
}

export async function getMemo(id: number): Promise<IdeaMemo | null> {
  const db = await getDb();
  const rows = await db.select<IdeaMemoRow[]>('SELECT * FROM idea_memos WHERE id = ?', [id]);
  return rows.length > 0 ? rowToMemo(rows[0]) : null;
}

export async function listMemos(query?: string, status?: string): Promise<IdeaMemoListItem[]> {
  const db = await getDb();

  const hasStatus = status && status !== 'all';
  const hasQuery = query && query.trim().length > 0;

  let sql: string;
  let params: unknown[];

  if (!hasQuery && !hasStatus) {
    sql = 'SELECT id, title, tags, status, notion_url, updated_at FROM idea_memos ORDER BY updated_at DESC';
    params = [];
  } else if (!hasQuery && hasStatus) {
    sql = 'SELECT id, title, tags, status, notion_url, updated_at FROM idea_memos WHERE status = ? ORDER BY updated_at DESC';
    params = [status];
  } else {
    // FTS + LIKE combined: try FTS5 MATCH then fall through to LIKE
    const q = `%${query!.trim()}%`;
    let ftsIds: Set<number> = new Set();
    try {
      const safeQ = query!.trim().replace(/["\\]/g, '');
      if (safeQ) {
        const ftsRows = await db.select<{ rowid: number }[]>(
          'SELECT rowid FROM idea_memos_fts WHERE idea_memos_fts MATCH ?',
          [`"${safeQ}"`],
        );
        ftsRows.forEach(r => ftsIds.add(r.rowid));
      }
    } catch {
      // FTS query malformed — use LIKE only
    }

    const statusFilter = hasStatus ? 'AND status = ?' : '';
    sql = `
      SELECT id, title, tags, status, notion_url, updated_at FROM idea_memos
      WHERE (
        id IN (${ftsIds.size > 0 ? [...ftsIds].join(',') : '0'})
        OR title LIKE ?
        OR tags LIKE ?
        OR raw_input LIKE ?
        OR memo_json LIKE ?
      ) ${statusFilter}
      ORDER BY updated_at DESC
    `;
    params = hasStatus ? [q, q, q, q, status] : [q, q, q, q];
  }

  const rows = await db.select<IdeaMemoListRow[]>(sql, params);
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    tags: r.tags,
    status: r.status as IdeaStatus,
    notionUrl: r.notion_url,
    updatedAt: r.updated_at,
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
  const titleOrTagsChanged = patch.title !== undefined || patch.tags !== undefined;

  await db.execute('BEGIN');
  try {
    const setParts: string[] = ["updated_at = datetime('now','localtime')"];
    const values: unknown[] = [];
    if (patch.title !== undefined) { setParts.push('title = ?'); values.push(patch.title); }
    if (patch.tags !== undefined) { setParts.push('tags = ?'); values.push(patch.tags); }
    if (patch.status !== undefined) { setParts.push('status = ?'); values.push(patch.status); }
    if (patch.notionUrl !== undefined) { setParts.push('notion_url = ?'); values.push(patch.notionUrl); }
    values.push(id);

    await db.execute(`UPDATE idea_memos SET ${setParts.join(', ')} WHERE id = ?`, values);

    if (titleOrTagsChanged) {
      await db.execute(
        "INSERT INTO idea_memos_fts(idea_memos_fts, rowid, title, tags) VALUES('delete', ?, ?, ?)",
        [id, current.title, current.tags],
      );
      await db.execute(
        'INSERT INTO idea_memos_fts(rowid, title, tags) VALUES(?, ?, ?)',
        [id, newTitle, newTags],
      );
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
    await db.execute(
      "INSERT INTO idea_memos_fts(idea_memos_fts, rowid, title, tags) VALUES('delete', ?, ?, ?)",
      [id, current.title, current.tags],
    );
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
  });
}
