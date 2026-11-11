-- Notes from the app's feedback sheet (2026-11-11). No account, no send key,
-- no IP: only what the person typed and which build they typed it in. The
-- nightly sweep drops a note after a year.

CREATE TABLE IF NOT EXISTS feedback (
  feedback_id TEXT PRIMARY KEY,            -- random, only so a row can be named
  created_at  INTEGER NOT NULL,            -- epoch ms
  note        TEXT NOT NULL,
  app_version TEXT NOT NULL DEFAULT '',    -- "1.0.0"
  app_update  TEXT NOT NULL DEFAULT '',    -- short id of the installed update, the same for everyone on it
  platform    TEXT NOT NULL DEFAULT '',    -- "ios 18.5"
  locale      TEXT NOT NULL DEFAULT ''     -- the app's language, "en"
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
