CREATE TABLE IF NOT EXISTS idea_memos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  raw_input  TEXT    NOT NULL DEFAULT '',
  memo_json  TEXT    NOT NULL DEFAULT '{}',
  tags       TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'draft',
  notion_url TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- FTS5 contentless index for title + tags.
-- Body search (raw_input / memo_json) uses LIKE fallback in application layer
-- because unicode61 is space-delimited and Japanese tokens have no spaces.
CREATE VIRTUAL TABLE IF NOT EXISTS idea_memos_fts USING fts5(
  title,
  tags,
  content        = '',
  tokenize       = 'unicode61 remove_diacritics 2'
);
