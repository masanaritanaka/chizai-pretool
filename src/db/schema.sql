-- 知財期限・ステータス管理
CREATE TABLE IF NOT EXISTS deadlines (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  law_domain                  TEXT    NOT NULL CHECK(law_domain IN ('特許','実用新案','意匠','商標')),
  title                       TEXT    NOT NULL,
  application_date            TEXT,   -- YYYY-MM-DD
  publication_date            TEXT,
  registration_date           TEXT,
  examination_request_deadline TEXT,
  annuity_renewal_deadline     TEXT,
  response_deadline            TEXT,
  status                      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed','abandoned')),
  notes                       TEXT,
  created_at                  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at                  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 防衛公開メモ
CREATE TABLE IF NOT EXISTS defensive_disclosures (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT    NOT NULL,
  content           TEXT    NOT NULL DEFAULT '',
  created_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  is_public         INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0,1)),
  patent_candidate  INTEGER NOT NULL DEFAULT 0 CHECK(patent_candidate IN (0,1)),
  notes             TEXT
);
