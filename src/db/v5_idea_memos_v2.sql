-- v5: idea_memos 拡張 — law_domain / linked_memo_ids / memo_text + FTS再構築 + saved_views

-- ── 新カラム追加 ──────────────────────────────────────────────────────────────
ALTER TABLE idea_memos ADD COLUMN law_domain     TEXT NOT NULL DEFAULT '';
ALTER TABLE idea_memos ADD COLUMN linked_memo_ids TEXT NOT NULL DEFAULT '[]';
-- memo_text: memo_json 全セクションの連結平文（アプリ側が書き込む）
ALTER TABLE idea_memos ADD COLUMN memo_text      TEXT NOT NULL DEFAULT '';

-- ── FTS 再構築（title / raw_input / memo_text / tags） ────────────────────────
-- contentless なので DROP してから CREATE し直す
DROP TABLE IF EXISTS idea_memos_fts;
CREATE VIRTUAL TABLE idea_memos_fts USING fts5(
  title,
  raw_input,
  memo_text,
  tags,
  content   = '',
  tokenize  = 'unicode61 remove_diacritics 2'
);

-- ── Saved Views ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_views (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  filter_json TEXT    NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ── インデックス ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_idea_memos_status     ON idea_memos(status);
CREATE INDEX IF NOT EXISTS idx_idea_memos_law_domain ON idea_memos(law_domain);
CREATE INDEX IF NOT EXISTS idx_idea_memos_updated_at ON idea_memos(updated_at);
