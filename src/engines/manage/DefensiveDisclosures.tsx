import { useEffect, useState } from 'react';
import {
  createDisclosure, deleteDisclosure, listDisclosures, updateDisclosure,
} from './db';
import type { DefensiveDisclosure, DefensiveDisclosureInput } from './types';

const EMPTY_INPUT: DefensiveDisclosureInput = {
  title: '',
  content: '',
  isPublic: false,
  patentCandidate: false,
  notes: null,
};

interface Props {
  onBack: () => void;
}

type FilterMode = 'all' | 'public' | 'private' | 'patent';

const COLOR = '#475569';

export function DefensiveDisclosures({ onBack }: Props) {
  const [items, setItems] = useState<DefensiveDisclosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [modalMode, setModalMode] = useState<'new' | 'detail' | null>(null);
  const [selected, setSelected] = useState<DefensiveDisclosure | null>(null);
  const [form, setForm] = useState<DefensiveDisclosureInput>(EMPTY_INPUT);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setItems(await listDisclosures());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = items.filter(d => {
    if (filter === 'public') return d.isPublic;
    if (filter === 'private') return !d.isPublic;
    if (filter === 'patent') return d.patentCandidate;
    return true;
  });

  function openNew() {
    setForm(EMPTY_INPUT);
    setSelected(null);
    setModalMode('new');
  }

  function openDetail(d: DefensiveDisclosure) {
    setSelected(d);
    setForm({
      title: d.title, content: d.content,
      isPublic: d.isPublic, patentCandidate: d.patentCandidate,
      notes: d.notes,
    });
    setModalMode('detail');
  }

  function closeModal() {
    setModalMode(null);
    setSelected(null);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (selected) {
        await updateDisclosure(selected.id, form);
      } else {
        await createDisclosure(form);
      }
      closeModal();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('このメモを削除しますか？')) return;
    try {
      await deleteDisclosure(id);
      closeModal();
      await load();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="manage-page">
      <button type="button" className="research-page__back" onClick={onBack}>← ホーム</button>

      <div className="manage-page__header">
        <span className="research-page__cluster-badge" style={{ background: COLOR, color: '#fff' }}>
          管理する
        </span>
        <h1 className="research-page__title">防衛公開メモ</h1>
        <p className="manage-page__desc">
          アイデアとタイムスタンプを記録し、先願性を確保します。特許化候補に昇格したら弁理士に相談してください。
        </p>
      </div>

      {error && <p className="manage-error">{error}</p>}

      {/* ツールバー */}
      <div className="manage-toolbar">
        <div className="disclosure-filter-tabs">
          {(['all', 'public', 'private', 'patent'] as FilterMode[]).map(f => (
            <button
              key={f}
              type="button"
              className={`filter-tab${filter === f ? ' filter-tab--active' : ''}`}
              style={{ '--cluster-color': COLOR } as React.CSSProperties}
              onClick={() => setFilter(f)}
            >
              {{ all: 'すべて', public: '公開', private: '非公開', patent: '特許化候補' }[f]}
            </button>
          ))}
        </div>
        <button type="button" className="manage-add-btn" style={{ '--cluster-color': COLOR } as React.CSSProperties} onClick={openNew}>
          + 新規作成
        </button>
      </div>

      {/* カード一覧 */}
      {loading ? (
        <p className="manage-empty">読み込み中…</p>
      ) : displayed.length === 0 ? (
        <p className="manage-empty">メモがありません。「＋ 新規作成」から追加してください。</p>
      ) : (
        <div className="disclosure-grid">
          {displayed.map(d => (
            <button key={d.id} type="button" className="disclosure-card" onClick={() => openDetail(d)}>
              <div className="disclosure-card__badges">
                {d.isPublic
                  ? <span className="badge badge--public">公開</span>
                  : <span className="badge badge--private">非公開</span>
                }
                {d.patentCandidate && <span className="badge badge--patent">特許化候補</span>}
              </div>
              <h3 className="disclosure-card__title">{d.title}</h3>
              <p className="disclosure-card__excerpt">
                {d.content.length > 80 ? d.content.slice(0, 80) + '…' : d.content || '（内容なし）'}
              </p>
              <span className="disclosure-card__date">{d.createdAt.replace('T', ' ').slice(0, 16)}</span>
            </button>
          ))}
        </div>
      )}

      {/* 新規作成 / 詳細編集モーダル */}
      {modalMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>{modalMode === 'new' ? '新規メモ作成' : 'メモを編集'}</h3>
              <button type="button" className="modal__close" onClick={closeModal}>×</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <label className="form-full">タイトル <span className="required">*</span>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="例: 〇〇を利用した△△の手法"
                  />
                </label>
                <label className="form-full">内容
                  <textarea
                    rows={8}
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="技術のポイント・先行技術との差異・想定用途などを記述してください"
                  />
                </label>
                <label className="form-full">備考
                  <textarea
                    rows={2}
                    value={form.notes ?? ''}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                  />
                </label>

                <div className="form-toggles">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
                    />
                    公開する（外部向けに開示済み）
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={form.patentCandidate}
                      onChange={e => setForm(f => ({ ...f, patentCandidate: e.target.checked }))}
                    />
                    特許化候補に昇格（弁理士要相談）
                  </label>
                </div>
              </div>

              {selected && (
                <p className="modal__meta">
                  作成: {selected.createdAt.slice(0, 16).replace('T', ' ')}
                  更新: {selected.updatedAt.slice(0, 16).replace('T', ' ')}
                </p>
              )}

              <div className="modal__footer">
                {selected && (
                  <button type="button" className="delete-btn" onClick={() => handleDelete(selected.id)}>
                    削除
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" onClick={closeModal}>キャンセル</button>
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
