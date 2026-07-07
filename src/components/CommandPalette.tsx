import { useEffect, useRef, useState } from 'react';
import { listMemos, type IdeaMemoListItem } from '../engines/research/idea04Db';
import { StatusBadge } from './StatusBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectMemo: (id: number) => void;
}

export function CommandPalette({ isOpen, onClose, onSelectMemo }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IdeaMemoListItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // フォーカス
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 検索
  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await listMemos(query || undefined);
        setResults(rows.slice(0, 8));
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isOpen]);

  // キーボード操作
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      onSelectMemo(results[selectedIndex].id);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp" onClick={e => e.stopPropagation()} role="dialog" aria-label="コマンドパレット">
        <div className="cp__search">
          <span className="cp__search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="cp__input"
            placeholder="アイデアメモを検索…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cp__esc-hint">ESC</kbd>
        </div>

        <div className="cp__results">
          {loading && (
            <div className="cp__loading">検索中…</div>
          )}
          {!loading && results.length === 0 && query && (
            <div className="cp__empty">「{query}」に一致するメモはありません</div>
          )}
          {!loading && results.length === 0 && !query && (
            <div className="cp__empty">アイデアメモを入力して検索</div>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`cp__item${i === selectedIndex ? ' cp__item--selected' : ''}`}
              onClick={() => onSelectMemo(item.id)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="cp__item-title">{item.title}</div>
              <div className="cp__item-meta">
                <StatusBadge status={item.status} />
                {item.tags && <span className="cp__item-tags">{item.tags}</span>}
                <span className="cp__item-date">{item.updatedAt.slice(0, 10)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
