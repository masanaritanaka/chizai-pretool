import { useEffect, useState } from 'react';
import { BackButton } from '../../components/BackButton';
import {
  createDeadline, deleteDeadline, listDeadlines, listNearDeadlines, updateDeadline,
} from './db';
import {
  LAW_DOMAINS, STATUS_LABELS, formatDate, isWithinDays, nearestDeadlineDate,
  type Deadline, type DeadlineInput, type DeadlineStatus, type LawDomain,
} from './types';

const EMPTY_INPUT: DeadlineInput = {
  lawDomain: '特許',
  title: '',
  applicationDate: null,
  publicationDate: null,
  registrationDate: null,
  examinationRequestDeadline: null,
  annuityRenewalDeadline: null,
  responseDeadline: null,
  status: 'active',
  notes: null,
};

interface Props {
  thresholdDays: number;
  onBack: () => void;
}

export function DeadlineManager({ thresholdDays, onBack }: Props) {
  const [rows, setRows] = useState<Deadline[]>([]);
  const [alerts, setAlerts] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<DeadlineStatus | 'all'>('all');
  const [filterDomain, setFilterDomain] = useState<LawDomain | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deadline | null>(null);
  const [form, setForm] = useState<DeadlineInput>(EMPTY_INPUT);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [all, near] = await Promise.all([
        listDeadlines(),
        listNearDeadlines(thresholdDays),
      ]);
      setRows(all);
      setAlerts(near);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = rows.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterDomain !== 'all' && r.lawDomain !== filterDomain) return false;
    return true;
  });

  function openNew() {
    setEditTarget(null);
    setForm(EMPTY_INPUT);
    setModalOpen(true);
  }

  function openEdit(d: Deadline) {
    setEditTarget(d);
    setForm({
      lawDomain: d.lawDomain, title: d.title,
      applicationDate: d.applicationDate, publicationDate: d.publicationDate,
      registrationDate: d.registrationDate,
      examinationRequestDeadline: d.examinationRequestDeadline,
      annuityRenewalDeadline: d.annuityRenewalDeadline,
      responseDeadline: d.responseDeadline,
      status: d.status, notes: d.notes,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateDeadline(editTarget.id, form);
      } else {
        await createDeadline(form);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('この案件を削除しますか？')) return;
    try {
      await deleteDeadline(id);
      await load();
    } catch (e) {
      setError(String(e));
    }
  }

  function setField<K extends keyof DeadlineInput>(key: K, value: DeadlineInput[K]) {
    setForm(f => ({ ...f, [key]: value === '' ? null : value }));
  }

  const COLOR = '#475569';

  return (
    <div className="manage-page">
      <div className="page-header">
        <BackButton onClick={onBack} clusterColor={COLOR} />
        <div className="page-header__meta">
          <span className="research-page__cluster-badge" style={{ background: COLOR, color: '#fff' }}>
            管理する
          </span>
          <h1 className="research-page__title">知財期限・ステータス管理</h1>
        </div>
      </div>

      {/* アラートバナー */}
      {alerts.length > 0 && (
        <div className="deadline-alert-banner">
          ⚠ {alerts.length}件の案件で {thresholdDays}日以内に期限が近づいています
          <span className="deadline-alert-banner__list">
            {alerts.map(a => a.title).join('、')}
          </span>
        </div>
      )}

      {error && <p className="manage-error">{error}</p>}

      {/* ツールバー */}
      <div className="manage-toolbar">
        <div className="manage-toolbar__filters">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
            <option value="all">すべてのステータス</option>
            {(Object.entries(STATUS_LABELS) as [DeadlineStatus, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={filterDomain} onChange={e => setFilterDomain(e.target.value as typeof filterDomain)}>
            <option value="all">すべての法域</option>
            {LAW_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button type="button" className="manage-add-btn" style={{ '--cluster-color': COLOR } as React.CSSProperties} onClick={openNew}>
          + 新規登録
        </button>
      </div>

      {/* テーブル */}
      {loading ? (
        <p className="manage-empty">読み込み中…</p>
      ) : displayed.length === 0 ? (
        <p className="manage-empty">案件がありません。「＋ 新規登録」から追加してください。</p>
      ) : (
        <div className="deadline-table-wrap">
          <table className="deadline-table">
            <thead>
              <tr>
                <th>案件名</th>
                <th>法域</th>
                <th>ステータス</th>
                <th>出願日</th>
                <th>登録日</th>
                <th>最近の期限</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(d => {
                const nearest = nearestDeadlineDate(d);
                const urgent = nearest ? isWithinDays(nearest, thresholdDays) : false;
                return (
                  <tr key={d.id} className={urgent ? 'deadline-table__row--urgent' : ''}>
                    <td className="deadline-table__title">{d.title}</td>
                    <td><span className="domain-badge" data-domain={d.lawDomain}>{d.lawDomain}</span></td>
                    <td><span className={`status-badge status-badge--${d.status}`}>{STATUS_LABELS[d.status]}</span></td>
                    <td>{formatDate(d.applicationDate)}</td>
                    <td>{formatDate(d.registrationDate)}</td>
                    <td className={urgent ? 'deadline-table__urgent-date' : ''}>{formatDate(nearest)}</td>
                    <td className="deadline-table__actions">
                      <button type="button" onClick={() => openEdit(d)}>編集</button>
                      <button type="button" className="delete-btn" onClick={() => handleDelete(d.id)}>削除</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 登録/編集モーダル */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>{editTarget ? '案件を編集' : '新規案件登録'}</h3>
              <button type="button" className="modal__close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <label>案件名 <span className="required">*</span>
                  <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="例: 〇〇特許 出願番号2024-12345" />
                </label>
                <label>法域
                  <select value={form.lawDomain} onChange={e => setField('lawDomain', e.target.value as LawDomain)}>
                    {LAW_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label>ステータス
                  <select value={form.status} onChange={e => setField('status', e.target.value as DeadlineStatus)}>
                    {(Object.entries(STATUS_LABELS) as [DeadlineStatus, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>

                <div className="form-section-label">日付</div>
                <label>出願日<input type="date" value={form.applicationDate ?? ''} onChange={e => setField('applicationDate', e.target.value)} /></label>
                <label>公開日<input type="date" value={form.publicationDate ?? ''} onChange={e => setField('publicationDate', e.target.value)} /></label>
                <label>登録日<input type="date" value={form.registrationDate ?? ''} onChange={e => setField('registrationDate', e.target.value)} /></label>

                <div className="form-section-label">期限（通知対象）</div>
                <label>審査請求期限<input type="date" value={form.examinationRequestDeadline ?? ''} onChange={e => setField('examinationRequestDeadline', e.target.value)} /></label>
                <label>年金・更新期限<input type="date" value={form.annuityRenewalDeadline ?? ''} onChange={e => setField('annuityRenewalDeadline', e.target.value)} /></label>
                <label>応答期限<input type="date" value={form.responseDeadline ?? ''} onChange={e => setField('responseDeadline', e.target.value)} /></label>

                <label className="form-full">備考
                  <textarea rows={3} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} />
                </label>
              </div>

              <div className="modal__footer">
                <button type="button" onClick={() => setModalOpen(false)}>キャンセル</button>
                <button
                  type="button"
                  className="modal__save-btn"
                  style={{ '--cluster-color': COLOR } as React.CSSProperties}
                  disabled={!form.title.trim() || saving}
                  onClick={handleSave}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
