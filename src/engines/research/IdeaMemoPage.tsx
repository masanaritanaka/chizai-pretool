import { useCallback, useEffect, useRef, useState } from 'react';
import { BackButton } from '../../components/BackButton';
import { DisclaimerBanner, DISCLAIMER_TEXT } from '../../components/DisclaimerBanner';
import { LoadingBar } from '../../components/LoadingBar';
import { StatusBadge } from '../../components/StatusBadge';
import { Toast } from '../../components/Toast';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ImageMediaType } from '../../lib/claude';
import { callClaude, callClaudeOcr, isClaudeError } from '../../lib/claude';
import { ACCEPT_ATTR, ingestFile, isAcceptedFile, type IngestResult } from '../../lib/fileIngest';
import { buildLinks, getGroupLines, openJplatpat } from '../../lib/jplatpat';
import { open } from '@tauri-apps/plugin-shell';
import { sendToNotion } from '../../lib/notion';
import { getSettingValue } from '../manage/db';
import { clusterColor, type Preset } from '../../home/presets';
import { buildSystemPrompt, buildUserMessage } from './prompts';
import type { IdeaMemo04Output } from './types';
import {
  countMemos, deleteMemo, deleteView,
  getMemo, listMemos, listSavedViews, saveMemo, saveView, updateMemo,
  parseFieldSyntax,
  type IdeaMemo, type IdeaMemoListItem, type IdeaStatus, type SavedView,
} from './idea04Db';

// ── ステータスラベル ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<IdeaStatus, string> = {
  draft: '下書き', researching: '調査中', consulted: '専門家相談済', archived: 'アーカイブ',
};

const ALL_STATUSES: IdeaStatus[] = ['draft', 'researching', 'consulted', 'archived'];
const LAW_DOMAINS = ['特許', '実用新案', '意匠', '商標'];

// ── 分析結果カード ─────────────────────────────────────────────────────────────

function IdeaMemoResultCard({
  memo, color, copied, onCopy,
}: {
  memo: IdeaMemo04Output; color: string; copied: string | null; onCopy: (text: string, key: string) => void;
}) {
  const jplatpatLinks = buildLinks(['特許', '実用新案'], memo.keyword_groups ?? []);

  return (
    <div className="research-card">
      <h2 className="research-card__heading" style={{ color }}>先行技術メモ</h2>

      <div className="patent-read-section">
        <div className="patent-read-section__label">アイデアの核</div>
        <p className="patent-read-section__body">{memo.core}</p>
      </div>

      <div className="patent-read-section">
        <div className="patent-read-section__label">新規性の焦点</div>
        <p className="patent-read-section__body">{memo.noveltyFocus}</p>
      </div>

      {memo.keyword_groups && memo.keyword_groups.length > 0 && (
        <div className="patent-read-section">
          <div className="patent-read-section__label">先行調査キーワード</div>
          <table className="patent-term-table">
            <thead><tr><th>構成要素</th><th>日本語</th><th>英語</th></tr></thead>
            <tbody>
              {memo.keyword_groups.map((kw, i) => (
                <tr key={i}>
                  <td className="patent-term-table__original">{kw.element}</td>
                  <td>{kw.terms_ja.join(' / ')}</td>
                  <td>{kw.terms_en.join(' / ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {memo.alternatives && memo.alternatives.length > 0 && (
        <div className="patent-read-section">
          <div className="patent-read-section__label">差別化・回避設計の選択肢</div>
          <ol className="patent-read-list">
            {memo.alternatives.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </div>
      )}

      {memo.preConsultChecklist && memo.preConsultChecklist.length > 0 && (
        <div className="memo-expert">
          <strong>弁理士相談前チェックリスト</strong>
          <ol>{memo.preConsultChecklist.map((item, i) => <li key={i}>{item}</li>)}</ol>
        </div>
      )}

      {jplatpatLinks.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          {jplatpatLinks.map(link => {
            const groupLines = getGroupLines(memo.keyword_groups ?? []);
            return (
              <div key={link.domain} className="jplatpat-block">
                <div className="jplatpat-block__label">{link.label}</div>
                <p className="jplatpat-hint">
                  論理式入力タブに貼り付けてください。選択入力を使う場合は下の各行を1つのキーワード欄に貼り付けます。
                </p>
                <div className="jplatpat-expression">
                  <code className="jplatpat-expression__code">{link.expression || '（キーワード抽出中）'}</code>
                  {link.expression && (
                    <button type="button" className="copy-btn" onClick={() => onCopy(link.expression, `expr-${link.domain}`)}>
                      {copied === `expr-${link.domain}` ? '論理式コピー済 ✓' : '論理式をコピー'}
                    </button>
                  )}
                </div>
                {groupLines.length > 0 && (
                  <div className="jplatpat-group-lines">
                    <div className="jplatpat-group-lines__head">選択入力用（各行 = キーワード欄1つ）</div>
                    {groupLines.map((g, i) => (
                      <div key={i} className="jplatpat-group-line">
                        <span className="jplatpat-group-line__element">{g.element}</span>
                        <code className="jplatpat-group-line__terms">{g.terms}</code>
                        <button
                          type="button" className="copy-btn copy-btn--sm"
                          onClick={() => onCopy(g.terms, `line-${link.domain}-${i}`)}
                        >
                          {copied === `line-${link.domain}-${i}` ? '✓' : 'コピー'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="jplatpat-open-btn" style={{ '--cluster-color': color } as React.CSSProperties} onClick={() => openJplatpat(link.url)}>
                  J-PlatPat で検索を開く →
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="research-disclaimer">{DISCLAIMER_TEXT}</p>
    </div>
  );
}

// ── メモ詳細ビュー ─────────────────────────────────────────────────────────────

function IdeaMemoDetailView({
  id, color, onBack, onDuplicate, onDeleted,
}: {
  id: number; color: string; onBack: () => void;
  onDuplicate: (rawInput: string) => void; onDeleted: () => void;
}) {
  const [memo, setMemo] = useState<IdeaMemo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editStatus, setEditStatus] = useState<IdeaStatus>('draft');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notionSending, setNotionSending] = useState(false);
  const [notionError, setNotionError] = useState<string | null>(null);
  const [copyKey, setCopyKey] = useState<string | null>(null);

  useEffect(() => {
    getMemo(id).then(m => {
      if (m) { setMemo(m); setEditTitle(m.title); setEditTags(m.tags); setEditStatus(m.status); }
    });
  }, [id]);

  if (!memo) {
    return (
      <div className="memo04-detail">
        <div className="skeleton-row" style={{ width: '60%', marginBottom: '0.75rem' }} />
        <div className="skeleton-row" /><div className="skeleton-row" />
      </div>
    );
  }

  const memoOutput: IdeaMemo04Output | null = (() => {
    try { return JSON.parse(memo.memoJson) as IdeaMemo04Output; } catch { return null; }
  })();

  async function handleSaveEdits() {
    if (!memo) return;
    setSaving(true);
    try {
      await updateMemo(memo.id, { title: editTitle.trim() || memo.title, tags: editTags, status: editStatus });
      setMemo(prev => prev ? { ...prev, title: editTitle.trim() || prev.title, tags: editTags, status: editStatus } : prev);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!memo) return;
    setDeleting(true);
    try { await deleteMemo(memo.id); onDeleted(); }
    finally { setDeleting(false); }
  }

  async function handleSendToNotion() {
    if (!memo) return;
    setNotionSending(true); setNotionError(null);
    try {
      const dbId = await getSettingValue('notion_database_id');
      if (!dbId) { setNotionError('設定画面で Notion データベースIDを登録してください。'); return; }
      const url = await sendToNotion(memo.title, memo.memoJson, memo.tags, dbId);
      await updateMemo(memo.id, { notionUrl: url });
      setMemo(prev => prev ? { ...prev, notionUrl: url } : prev);
    } catch (e) { setNotionError(String(e)); }
    finally { setNotionSending(false); }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setCopyKey(key); setTimeout(() => setCopyKey(null), 1500); });
  }

  const jplatpatLinks = buildLinks(['特許', '実用新案'], memoOutput?.keyword_groups ?? []);

  return (
    <div className="memo04-detail">
      <button type="button" className="memo04-detail__back" onClick={onBack}>← メモ一覧</button>

      <div className="memo04-detail__edit-card">
        <div className="memo04-detail__field">
          <label className="memo04-detail__label">タイトル</label>
          <input type="text" className="memo04-detail__title-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
        </div>
        <div className="memo04-detail__field memo04-detail__field--row">
          <div style={{ flex: 1 }}>
            <label className="memo04-detail__label">タグ（カンマ区切り）</label>
            <input type="text" className="memo04-detail__tags-input" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="例: モバイル, IoT, 省エネ" />
          </div>
          <div>
            <label className="memo04-detail__label">ステータス</label>
            <select className="memo04-detail__status-select" value={editStatus} onChange={e => setEditStatus(e.target.value as IdeaStatus)}>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        {memo.lawDomain && (
          <div className="memo04-detail__domain-badge">法域: {memo.lawDomain}</div>
        )}
        <div className="memo04-detail__edit-actions">
          <button type="button" className="memo04-detail__save-btn" style={{ background: color }} onClick={handleSaveEdits} disabled={saving}>
            {saving ? '保存中…' : '変更を保存'}
          </button>
          <span className="memo04-detail__dates">作成: {memo.createdAt.slice(0, 10)} / 更新: {memo.updatedAt.slice(0, 10)}</span>
        </div>
      </div>

      <div className="memo04-notion-row">
        {memo.notionUrl ? (
          <button type="button" className="memo04-notion-open-btn" onClick={() => open(memo.notionUrl!)}>Notion で開く →</button>
        ) : (
          <button type="button" className="memo04-notion-send-btn" onClick={handleSendToNotion} disabled={notionSending}>
            {notionSending ? '送信中…' : 'Notion に送る'}
          </button>
        )}
        <button type="button" className="memo04-duplicate-btn" onClick={() => onDuplicate(memo.rawInput)}>
          このアイデアの派生を作る
        </button>
      </div>
      {notionError && <p className="memo04-notion-error">{notionError}</p>}

      {memoOutput && (
        <div className="research-card" style={{ marginTop: '1rem' }}>
          <div className="patent-read-section">
            <div className="patent-read-section__label">アイデアの核</div>
            <p className="patent-read-section__body">{memoOutput.core}</p>
          </div>
          <div className="patent-read-section">
            <div className="patent-read-section__label">新規性の焦点</div>
            <p className="patent-read-section__body">{memoOutput.noveltyFocus}</p>
          </div>
          {(memoOutput.keyword_groups ?? []).length > 0 && (
            <div className="patent-read-section">
              <div className="patent-read-section__label">先行調査キーワード</div>
              <table className="patent-term-table">
                <thead><tr><th>構成要素</th><th>日本語</th><th>英語</th></tr></thead>
                <tbody>
                  {(memoOutput.keyword_groups ?? []).map((kw, i) => (
                    <tr key={i}>
                      <td className="patent-term-table__original">{kw.element}</td>
                      <td>{kw.terms_ja.join(' / ')}</td>
                      <td>{kw.terms_en.join(' / ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {memoOutput.alternatives.length > 0 && (
            <div className="patent-read-section">
              <div className="patent-read-section__label">差別化・回避設計の選択肢</div>
              <ol className="patent-read-list">{memoOutput.alternatives.map((a, i) => <li key={i}>{a}</li>)}</ol>
            </div>
          )}
          {memoOutput.preConsultChecklist.length > 0 && (
            <div className="memo-expert">
              <strong>弁理士相談前チェックリスト</strong>
              <ol>{memoOutput.preConsultChecklist.map((item, i) => <li key={i}>{item}</li>)}</ol>
            </div>
          )}
        </div>
      )}

      {jplatpatLinks.length > 0 && (
        <div className="research-card" style={{ marginTop: '0.75rem' }}>
          {jplatpatLinks.map(link => {
            const groupLines = getGroupLines(memoOutput?.keyword_groups ?? []);
            return (
              <div key={link.domain} className="jplatpat-block">
                <div className="jplatpat-block__label">{link.label}</div>
                <p className="jplatpat-hint">
                  論理式入力タブに貼り付けてください。選択入力を使う場合は下の各行を1つのキーワード欄に貼り付けます。
                </p>
                <div className="jplatpat-expression">
                  <code className="jplatpat-expression__code">{link.expression}</code>
                  {link.expression && (
                    <button type="button" className="copy-btn" onClick={() => handleCopy(link.expression, `expr-${link.domain}`)}>
                      {copyKey === `expr-${link.domain}` ? '論理式コピー済 ✓' : '論理式をコピー'}
                    </button>
                  )}
                </div>
                {groupLines.length > 0 && (
                  <div className="jplatpat-group-lines">
                    <div className="jplatpat-group-lines__head">選択入力用（各行 = キーワード欄1つ）</div>
                    {groupLines.map((g, i) => (
                      <div key={i} className="jplatpat-group-line">
                        <span className="jplatpat-group-line__element">{g.element}</span>
                        <code className="jplatpat-group-line__terms">{g.terms}</code>
                        <button
                          type="button" className="copy-btn copy-btn--sm"
                          onClick={() => handleCopy(g.terms, `line-${link.domain}-${i}`)}
                        >
                          {copyKey === `line-${link.domain}-${i}` ? '✓' : 'コピー'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="jplatpat-open-btn" style={{ '--cluster-color': color } as React.CSSProperties} onClick={() => openJplatpat(link.url)}>
                  J-PlatPat で検索を開く →
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="memo04-detail__danger">
        {!confirmDelete ? (
          <button type="button" className="memo04-detail__delete-btn" onClick={() => setConfirmDelete(true)}>このメモを削除する</button>
        ) : (
          <div className="memo04-detail__confirm-delete">
            <span>本当に削除しますか？</span>
            <button type="button" className="memo04-detail__delete-confirm-btn" onClick={handleDelete} disabled={deleting}>
              {deleting ? '削除中…' : '削除する'}
            </button>
            <button type="button" className="memo04-detail__delete-cancel-btn" onClick={() => setConfirmDelete(false)}>キャンセル</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3層検索メモ一覧 ───────────────────────────────────────────────────────────

function IdeaMemoListTab({
  color, onSelect, onCountChange,
}: {
  color: string; onSelect: (id: number) => void; onCountChange: (n: number) => void;
}) {
  const [rawQuery, setRawQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('');
  const [items, setItems] = useState<IdeaMemoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showSaveView, setShowSaveView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { listSavedViews().then(setSavedViews).catch(() => {}); }, []);

  const loadList = useCallback(async (raw: string, status: string, domain: string) => {
    setLoading(true);
    try {
      const parsed = parseFieldSyntax(raw);
      if (status !== 'all') parsed.status = status;
      if (domain) parsed.domain = domain;
      const rows = await listMemos(parsed);
      setItems(rows);
      const total = await countMemos();
      onCountChange(total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [onCountChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadList(rawQuery, statusFilter, domainFilter), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawQuery, statusFilter, domainFilter, loadList]);

  useEffect(() => { loadList('', 'all', ''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyView(view: SavedView) {
    try {
      const f = JSON.parse(view.filterJson) as { query?: string; status?: string; domain?: string };
      setRawQuery(f.query ?? '');
      setStatusFilter(f.status ?? 'all');
      setDomainFilter(f.domain ?? '');
    } catch { /* malformed view */ }
  }

  async function handleSaveView() {
    if (!newViewName.trim()) return;
    const filterJson = JSON.stringify({ query: rawQuery, status: statusFilter, domain: domainFilter });
    await saveView(newViewName.trim(), filterJson);
    const views = await listSavedViews();
    setSavedViews(views);
    setNewViewName('');
    setShowSaveView(false);
  }

  async function handleDeleteView(id: number) {
    await deleteView(id);
    setSavedViews(prev => prev.filter(v => v.id !== id));
  }

  const hasActiveFilters = rawQuery || statusFilter !== 'all' || domainFilter;

  return (
    <div className="memo04-list">
      {/* 保存済みビュー行 */}
      {savedViews.length > 0 && (
        <div className="memo04-saved-views">
          {savedViews.map(v => (
            <span key={v.id} className="memo04-saved-view-chip">
              <button type="button" onClick={() => applyView(v)}>{v.name}</button>
              <button type="button" className="memo04-saved-view-chip__del" onClick={() => handleDeleteView(v.id)}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* 検索ボックス（フィールド構文対応） */}
      <div className="memo04-list__search-row">
        <input
          type="text"
          className="memo04-list__search"
          placeholder="キーワード検索 / status:draft / tag:AI / domain:特許 / updated:>2026-01-01"
          value={rawQuery}
          onChange={e => setRawQuery(e.target.value)}
        />
        {hasActiveFilters && (
          <button
            type="button"
            className="memo04-clear-filter-btn"
            onClick={() => { setRawQuery(''); setStatusFilter('all'); setDomainFilter(''); }}
          >
            クリア
          </button>
        )}
      </div>

      {/* フィルタチップ行 */}
      <div className="memo04-list__filters">
        {/* ステータスチップ */}
        {['all', ...ALL_STATUSES].map(s => (
          <button
            key={s} type="button"
            className={`memo04-filter-btn${statusFilter === s ? ' memo04-filter-btn--active' : ''}`}
            style={statusFilter === s ? { borderColor: color, color } : undefined}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'すべて' : STATUS_LABEL[s as IdeaStatus]}
          </button>
        ))}
        <span className="memo04-filter-divider">|</span>
        {/* 法域チップ */}
        {LAW_DOMAINS.map(d => (
          <button
            key={d} type="button"
            className={`memo04-filter-btn${domainFilter === d ? ' memo04-filter-btn--active' : ''}`}
            style={domainFilter === d ? { borderColor: color, color } : undefined}
            onClick={() => setDomainFilter(prev => prev === d ? '' : d)}
          >
            {d}
          </button>
        ))}
        <span className="memo04-filter-divider">|</span>
        {/* ビュー保存 */}
        <button
          type="button"
          className="memo04-save-view-btn"
          onClick={() => setShowSaveView(v => !v)}
        >
          ＋ビューを保存
        </button>
      </div>

      {/* ビュー名入力 */}
      {showSaveView && (
        <div className="memo04-save-view-form">
          <input
            type="text"
            className="memo04-save-view-input"
            placeholder="ビュー名を入力…"
            value={newViewName}
            onChange={e => setNewViewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveView(); }}
            autoFocus
          />
          <button type="button" className="memo04-save-view-confirm" onClick={handleSaveView}>保存</button>
          <button type="button" onClick={() => setShowSaveView(false)}>キャンセル</button>
        </div>
      )}

      {/* 一覧 */}
      {loading ? (
        <div className="memo04-list__skeletons">{[0, 1, 2].map(i => <div key={i} className="skeleton-row" />)}</div>
      ) : items.length === 0 ? (
        <div className="memo04-empty">
          {hasActiveFilters ? '条件に一致するメモはありません' : (
            <div className="memo04-empty__initial">
              <div className="memo04-empty__icon">💡</div>
              <p>最初のアイデアを分析すると、ここに自動で貯まります</p>
            </div>
          )}
        </div>
      ) : (
        <div className="memo04-list__items">
          {items.map(item => (
            <button key={item.id} type="button" className="memo04-list-item" onClick={() => onSelect(item.id)}>
              <div className="memo04-list-item__title">{item.title}</div>
              <div className="memo04-list-item__meta">
                <StatusBadge status={item.status} />
                {item.lawDomain && <span className="memo04-list-item__domain">{item.lawDomain}</span>}
                {item.tags && (
                  <span className="memo04-list-item__tags">
                    {item.tags.split(',').filter(Boolean).map(t => (
                      <span key={t} className="memo-tag">{t.trim()}</span>
                    ))}
                  </span>
                )}
                {item.notionUrl && <span className="memo04-list-item__notion">Notion ✓</span>}
                <span className="memo04-list-item__date">{item.updatedAt.slice(0, 10)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

type Tab = 'analyze' | 'list';

type AnalyzeState =
  | { status: 'idle' }
  | { status: 'extracting'; fileName: string }
  | { status: 'ocr'; fileName: string }
  | { status: 'calling' }
  | { status: 'error'; message: string; errorType: string }
  | { status: 'done'; memo: IdeaMemo04Output };

interface ToastData { message: string; memoId: number; }

interface Props {
  preset: Preset;
  onBack: () => void;
  initialMemoId?: number | null;
  onClearInitialMemoId?: () => void;
}

export function IdeaMemoPage({ preset, onBack, initialMemoId, onClearInitialMemoId }: Props) {
  const [tab, setTab] = useState<Tab>('analyze');
  const [memoCount, setMemoCount] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const [textInput, setTextInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>({ status: 'idle' });
  const [copied, setCopied] = useState<string | null>(null);

  const autoSavedRef = useRef(false);
  const rawInputRef = useRef('');
  const [toast, setToast] = useState<ToastData | null>(null);

  const color = clusterColor[preset.cluster];
  const lawDomain = preset.lawDomains.join('・');

  useEffect(() => {
    if (initialMemoId != null) { setTab('list'); setDetailId(initialMemoId); onClearInitialMemoId?.(); }
  }, [initialMemoId, onClearInitialMemoId]);

  useEffect(() => { countMemos().then(setMemoCount).catch(() => {}); }, []);

  // 自動保存
  useEffect(() => {
    if (analyzeState.status !== 'done') { autoSavedRef.current = false; return; }
    if (autoSavedRef.current) return;
    autoSavedRef.current = true;

    const memo = analyzeState.memo;
    const title = (memo.core ?? '').slice(0, 80) || 'アイデアメモ';
    saveMemo({ title, rawInput: rawInputRef.current, memoJson: JSON.stringify(memo), lawDomain })
      .then(id => { setToast({ message: '✓ メモに保存しました', memoId: id }); setMemoCount(c => c + 1); })
      .catch(() => { autoSavedRef.current = false; });
  }, [analyzeState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ファイル処理 ──────────────────────────────────────────────────────────────

  const handleFileRef = useRef<(file: File) => Promise<void>>(null as unknown as (file: File) => Promise<void>);

  async function handleFile(file: File) {
    setIngestError(null);
    if (!isAcceptedFile(file)) { setIngestError(`対応していないファイル形式です（${file.name}）。`); return; }
    setAnalyzeState({ status: 'extracting', fileName: file.name });
    let result: IngestResult;
    try { result = await ingestFile(file); }
    catch (e) { setAnalyzeState({ status: 'idle' }); setIngestError(`読み込みエラー: ${String(e).slice(0, 150)}`); return; }
    if (result.type === 'error') { setAnalyzeState({ status: 'idle' }); setIngestError(result.reason); return; }
    if (result.type === 'image') {
      setAnalyzeState({ status: 'ocr', fileName: file.name });
      try {
        const ocrText = await callClaudeOcr(result.base64, result.mediaType as ImageMediaType);
        setTextInput(prev => prev.trim() ? `${prev}\n\n[画像から読み取り: ${file.name}]\n${ocrText}` : `[画像から読み取り: ${file.name}]\n${ocrText}`);
        setAnalyzeState({ status: 'idle' });
      } catch (e) {
        setAnalyzeState({ status: 'idle' });
        setIngestError(isClaudeError(e) ? e.message : '画像の文字読み取りに失敗しました。');
      }
      return;
    }
    setTextInput(prev => prev.trim() ? `${prev}\n\n[${file.name}]\n${result.text}` : result.text);
    setAnalyzeState({ status: 'idle' });
  }

  useEffect(() => { handleFileRef.current = handleFile; });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebviewWindow().onDragDropEvent(async (event) => {
      const { type } = event.payload;
      if (type === 'enter' || type === 'over') setIsDragOver(true);
      else if (type === 'leave') setIsDragOver(false);
      else if (type === 'drop') {
        setIsDragOver(false);
        const paths: string[] = (event.payload as { paths: string[] }).paths ?? [];
        if (!paths.length) return;
        const path = paths[0];
        const filename = path.split('/').pop() || path.split('\\').pop() || path;
        try {
          const bytes = await invoke<number[]>('read_dropped_file', { path });
          await handleFileRef.current(new File([new Uint8Array(bytes)], filename));
        } catch (e) { setIngestError(`ファイルの読み込みに失敗しました: ${String(e).slice(0, 120)}`); }
      }
    }).then(fn => { if (cancelled) fn(); else unlisten = fn; });
    return () => { cancelled = true; unlisten?.(); };
  }, [preset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true); }
  function onDragLeave() { setIsDragOver(false); }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textInput.trim()) return;
    rawInputRef.current = textInput;
    autoSavedRef.current = false;
    setAnalyzeState({ status: 'calling' });
    try {
      const raw = await callClaude(buildSystemPrompt(preset), buildUserMessage(preset, textInput));
      const m = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : raw) as IdeaMemo04Output;
      setAnalyzeState({ status: 'done', memo: parsed });
    } catch (e: unknown) {
      const errMsg = (typeof e === 'object' && e !== null && 'message' in e) ? (e as { message: string }).message : String(e);
      const errType = (typeof e === 'object' && e !== null && 'errorType' in e) ? (e as { errorType: string }).errorType : 'unknown';
      setAnalyzeState({ status: 'error', message: errMsg, errorType: errType });
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  }

  async function handleUndo() {
    if (!toast) return;
    try { await deleteMemo(toast.memoId); setMemoCount(c => Math.max(0, c - 1)); }
    catch { /* best-effort */ }
    setToast(null);
  }

  function handleDuplicate(rawInput: string) {
    setTextInput(rawInput); setAnalyzeState({ status: 'idle' }); setDetailId(null); setTab('analyze');
  }

  const isBusy = analyzeState.status === 'calling' || analyzeState.status === 'extracting' || analyzeState.status === 'ocr';

  return (
    <div className="research-page" style={{ '--cluster-color': color } as React.CSSProperties}>
      <div className="research-page__header">
        <BackButton onClick={onBack} clusterColor={color} />
        <div className="research-page__meta">
          <span className="research-page__cluster-badge" style={{ background: color, color: '#fff' }}>{preset.cluster}</span>
          <h1 className="research-page__title">{preset.label}</h1>
        </div>
      </div>

      {isBusy && <LoadingBar label="AI分析中..." color={color} />}

      <div className="memo04-tabs">
        <button type="button" className={`memo04-tab${tab === 'analyze' ? ' memo04-tab--active' : ''}`} style={tab === 'analyze' ? { borderColor: color, color } : undefined} onClick={() => setTab('analyze')}>分析する</button>
        <button type="button" className={`memo04-tab${tab === 'list' ? ' memo04-tab--active' : ''}`} style={tab === 'list' ? { borderColor: color, color } : undefined} onClick={() => { setTab('list'); setDetailId(null); }}>
          保存済みメモ{memoCount > 0 ? ` (${memoCount}件)` : ''}
        </button>
      </div>

      {tab === 'analyze' && (
        <>
          <form
            className={`research-page__form${isDragOver ? ' research-page__form--drag' : ''}`}
            onSubmit={handleSubmit}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <textarea
              className="research-page__textarea"
              rows={8}
              placeholder="自社のアイデアや技術的な構想を自由に書いてください。&#10;メモやドキュメントをドロップしても読み込めます。"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              disabled={isBusy}
            />
            {ingestError && <p className="research-error research-error--network"><strong>読み込みエラー</strong> {ingestError}</p>}
            <input type="file" accept={ACCEPT_ATTR} style={{ display: 'none' }} />
            <button type="submit" className="research-page__submit" disabled={isBusy || !textInput.trim()}>
              {analyzeState.status === 'calling' ? 'AI 分析中…' :
               analyzeState.status === 'extracting' ? '読み込み中…' :
               analyzeState.status === 'ocr' ? 'OCR 実行中…' : '先行技術メモを作成'}
            </button>
          </form>

          {analyzeState.status === 'error' && (
            <div className={`research-error research-error--${analyzeState.errorType}`}>
              <strong>エラーが発生しました</strong>
              <p>{analyzeState.message}</p>
              {analyzeState.errorType === 'no_key' && <p className="research-error__action">設定画面でAPIキーを登録してください。</p>}
            </div>
          )}

          {analyzeState.status === 'done' && (
            <IdeaMemoResultCard memo={analyzeState.memo} color={color} copied={copied} onCopy={handleCopy} />
          )}
        </>
      )}

      {tab === 'list' && detailId === null && (
        <IdeaMemoListTab color={color} onSelect={id => setDetailId(id)} onCountChange={setMemoCount} />
      )}

      {tab === 'list' && detailId !== null && (
        <IdeaMemoDetailView
          id={detailId} color={color}
          onBack={() => setDetailId(null)}
          onDuplicate={handleDuplicate}
          onDeleted={() => { setDetailId(null); setMemoCount(c => Math.max(0, c - 1)); }}
        />
      )}

      {toast && (
        <Toast message={toast.message} onUndo={handleUndo} onDismiss={() => setToast(null)} />
      )}

      <DisclaimerBanner />
    </div>
  );
}
