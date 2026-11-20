-- Translation review (2026-11-20): a native translator goes over the app's Hebrew at
-- songnook.app/review/he/<link>. One row per line he has touched; every save is also
-- appended to the history, so nothing he typed is ever lost to a later save.

CREATE TABLE IF NOT EXISTS review_edits (
  review      TEXT NOT NULL,              -- "he"
  item_id     TEXT NOT NULL,              -- the line's id (its first catalog key, or term:<word>)
  forms       TEXT NOT NULL DEFAULT '{}', -- JSON {"": "…", "one": "…"}: his Hebrew per plural form; empty = keep
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',   -- 'ok' (keep as is) | 'changed' | ''
  updated_at  INTEGER NOT NULL,           -- epoch ms
  PRIMARY KEY (review, item_id)
);

CREATE TABLE IF NOT EXISTS review_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  review      TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  forms       TEXT NOT NULL,
  note        TEXT NOT NULL,
  status      TEXT NOT NULL,
  saved_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_history_item ON review_history(review, item_id, saved_at);
