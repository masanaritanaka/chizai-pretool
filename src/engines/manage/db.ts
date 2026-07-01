import Database from '@tauri-apps/plugin-sql';
import type { Deadline, DeadlineInput, DefensiveDisclosure, DefensiveDisclosureInput } from './types';

const DB_URL = 'sqlite:chizai-pretool.db';
let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load(DB_URL);
  return _db;
}

// ─── Row shapes returned by SQLite ───────────────────────────────────────────

interface DeadlineRow {
  id: number;
  law_domain: string;
  title: string;
  application_date: string | null;
  publication_date: string | null;
  registration_date: string | null;
  examination_request_deadline: string | null;
  annuity_renewal_deadline: string | null;
  response_deadline: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DisclosureRow {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_public: number;
  patent_candidate: number;
  notes: string | null;
}

function rowToDeadline(r: DeadlineRow): Deadline {
  return {
    id: r.id,
    lawDomain: r.law_domain as Deadline['lawDomain'],
    title: r.title,
    applicationDate: r.application_date,
    publicationDate: r.publication_date,
    registrationDate: r.registration_date,
    examinationRequestDeadline: r.examination_request_deadline,
    annuityRenewalDeadline: r.annuity_renewal_deadline,
    responseDeadline: r.response_deadline,
    status: r.status as Deadline['status'],
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToDisclosure(r: DisclosureRow): DefensiveDisclosure {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    isPublic: r.is_public === 1,
    patentCandidate: r.patent_candidate === 1,
    notes: r.notes,
  };
}

// ─── Deadlines ────────────────────────────────────────────────────────────────

export async function listDeadlines(): Promise<Deadline[]> {
  const db = await getDb();
  const rows = await db.select<DeadlineRow[]>('SELECT * FROM deadlines ORDER BY updated_at DESC');
  return rows.map(rowToDeadline);
}

export async function createDeadline(input: DeadlineInput): Promise<number | undefined> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO deadlines
      (law_domain,title,application_date,publication_date,registration_date,
       examination_request_deadline,annuity_renewal_deadline,response_deadline,
       status,notes,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`,
    [
      input.lawDomain, input.title,
      input.applicationDate ?? null, input.publicationDate ?? null,
      input.registrationDate ?? null, input.examinationRequestDeadline ?? null,
      input.annuityRenewalDeadline ?? null, input.responseDeadline ?? null,
      input.status, input.notes ?? null,
    ],
  );
  return result.lastInsertId;
}

export async function updateDeadline(id: number, input: DeadlineInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE deadlines SET
      law_domain=?,title=?,application_date=?,publication_date=?,registration_date=?,
      examination_request_deadline=?,annuity_renewal_deadline=?,response_deadline=?,
      status=?,notes=?,updated_at=datetime('now','localtime')
     WHERE id=?`,
    [
      input.lawDomain, input.title,
      input.applicationDate ?? null, input.publicationDate ?? null,
      input.registrationDate ?? null, input.examinationRequestDeadline ?? null,
      input.annuityRenewalDeadline ?? null, input.responseDeadline ?? null,
      input.status, input.notes ?? null, id,
    ],
  );
}

export async function deleteDeadline(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM deadlines WHERE id=?', [id]);
}

/** threshold 日以内に期限が迫っている active レコードを返す */
export async function listNearDeadlines(thresholdDays: number): Promise<Deadline[]> {
  const db = await getDb();
  const limit = new Date();
  limit.setDate(limit.getDate() + thresholdDays);
  const limitStr = limit.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const rows = await db.select<DeadlineRow[]>(
    `SELECT * FROM deadlines WHERE status='active' AND (
       (examination_request_deadline IS NOT NULL AND examination_request_deadline >= ? AND examination_request_deadline <= ?) OR
       (annuity_renewal_deadline     IS NOT NULL AND annuity_renewal_deadline     >= ? AND annuity_renewal_deadline     <= ?) OR
       (response_deadline            IS NOT NULL AND response_deadline            >= ? AND response_deadline            <= ?)
     ) ORDER BY updated_at DESC`,
    [todayStr, limitStr, todayStr, limitStr, todayStr, limitStr],
  );
  return rows.map(rowToDeadline);
}

// ─── Defensive disclosures ────────────────────────────────────────────────────

export async function listDisclosures(): Promise<DefensiveDisclosure[]> {
  const db = await getDb();
  const rows = await db.select<DisclosureRow[]>(
    'SELECT * FROM defensive_disclosures ORDER BY updated_at DESC',
  );
  return rows.map(rowToDisclosure);
}

export async function createDisclosure(input: DefensiveDisclosureInput): Promise<number | undefined> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO defensive_disclosures (title,content,is_public,patent_candidate,notes,updated_at)
     VALUES (?,?,?,?,?,datetime('now','localtime'))`,
    [
      input.title, input.content,
      input.isPublic ? 1 : 0, input.patentCandidate ? 1 : 0,
      input.notes ?? null,
    ],
  );
  return result.lastInsertId;
}

export async function updateDisclosure(id: number, input: DefensiveDisclosureInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE defensive_disclosures SET
       title=?,content=?,is_public=?,patent_candidate=?,notes=?,
       updated_at=datetime('now','localtime')
     WHERE id=?`,
    [
      input.title, input.content,
      input.isPublic ? 1 : 0, input.patentCandidate ? 1 : 0,
      input.notes ?? null, id,
    ],
  );
}

export async function deleteDisclosure(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM defensive_disclosures WHERE id=?', [id]);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettingValue(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM settings WHERE key=?',
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSettingValue(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value],
  );
}
