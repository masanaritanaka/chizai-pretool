import Database from '@tauri-apps/plugin-sql';
import type { WatchTarget, WatchTargetInput } from './types';

const DB_URL = 'sqlite:chizai-pretool.db';
let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load(DB_URL);
  return _db;
}

interface WatchTargetRow {
  id: number;
  name: string;
  law_domain: string;
  patent_expression: string | null;
  trademark_expression: string | null;
  notes: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTarget(r: WatchTargetRow): WatchTarget {
  return {
    id: r.id,
    name: r.name,
    lawDomain: r.law_domain as WatchTarget['lawDomain'],
    patentExpression: r.patent_expression,
    trademarkExpression: r.trademark_expression,
    notes: r.notes,
    lastCheckedAt: r.last_checked_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listWatchTargets(): Promise<WatchTarget[]> {
  const db = await getDb();
  const rows = await db.select<WatchTargetRow[]>(
    'SELECT * FROM watch_targets ORDER BY updated_at DESC',
  );
  return rows.map(rowToTarget);
}

export async function createWatchTarget(input: WatchTargetInput): Promise<number | undefined> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO watch_targets
       (name, law_domain, patent_expression, trademark_expression, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))`,
    [
      input.name, input.lawDomain,
      input.patentExpression ?? null,
      input.trademarkExpression ?? null,
      input.notes ?? null,
    ],
  );
  return result.lastInsertId;
}

export async function markChecked(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE watch_targets
       SET last_checked_at = datetime('now','localtime'),
           updated_at      = datetime('now','localtime')
     WHERE id = ?`,
    [id],
  );
}

export async function deleteWatchTarget(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM watch_targets WHERE id=?', [id]);
}
