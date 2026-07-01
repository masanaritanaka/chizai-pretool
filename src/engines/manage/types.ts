export type LawDomain = '特許' | '実用新案' | '意匠' | '商標';
export type DeadlineStatus = 'active' | 'closed' | 'abandoned';

export const LAW_DOMAINS: LawDomain[] = ['特許', '実用新案', '意匠', '商標'];

export const STATUS_LABELS: Record<DeadlineStatus, string> = {
  active: '継続中',
  closed: '権利消滅',
  abandoned: '放棄',
};

export interface Deadline {
  id: number;
  lawDomain: LawDomain;
  title: string;
  applicationDate: string | null;
  publicationDate: string | null;
  registrationDate: string | null;
  examinationRequestDeadline: string | null;
  annuityRenewalDeadline: string | null;
  responseDeadline: string | null;
  status: DeadlineStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeadlineInput = Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>;

export interface DefensiveDisclosure {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  patentCandidate: boolean;
  notes: string | null;
}

export type DefensiveDisclosureInput = Omit<DefensiveDisclosure, 'id' | 'createdAt' | 'updatedAt'>;

/** 指定した案件の「最も近い期限日」を返す（ない場合 null） */
export function nearestDeadlineDate(d: Deadline): string | null {
  const dates = [
    d.examinationRequestDeadline,
    d.annuityRenewalDeadline,
    d.responseDeadline,
  ].filter((v): v is string => v !== null && v !== '');
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

/** ISO date 文字列が today から `days` 日以内かつ未来かどうか */
export function isWithinDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return d >= today && d <= limit;
}

/** 日付文字列を "YYYY/MM/DD" 形式で表示 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return dateStr.replace(/-/g, '/');
}
