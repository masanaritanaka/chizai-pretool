-- 競合知財ウォッチャー 監視対象テーブル
CREATE TABLE IF NOT EXISTS watch_targets (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT    NOT NULL,
  law_domain            TEXT    NOT NULL DEFAULT 'both'
                          CHECK(law_domain IN ('特許','商標','both')),
  patent_expression     TEXT,
  trademark_expression  TEXT,
  notes                 TEXT,
  last_checked_at       TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
