-- Who may send (2026-11-01). No accounts: a SENDER is one SongNook install,
-- known by the hash of a random key the app keeps. A browser sends as a
-- sender once the app has paired it with a short code.

CREATE TABLE IF NOT EXISTS senders (
  sender_id       TEXT PRIMARY KEY,        -- "s_" + sha256 of the app's send key
  created_at      INTEGER NOT NULL,        -- epoch ms, first time the server saw it
  rc_app_user_id  TEXT,                    -- RevenueCat app user id, once billing runs
  trial_ends_at   INTEGER,                 -- the app's free month, clamped to first sight + 31 days
  pro_until       INTEGER,                 -- cached RevenueCat answer (epoch ms; 0 = not Pro)
  pro_checked_at  INTEGER                  -- when that answer was fetched
);

-- One row per sealed link, kept 31 days: the free allowance counts these,
-- and transfers themselves are swept after 7.
CREATE TABLE IF NOT EXISTS send_log (
  sender_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_send_log_sender ON send_log(sender_id, created_at);

-- A browser asking to be paired: it holds the secret (cookie), the person
-- types the code into the app, the app fills sender_id.
CREATE TABLE IF NOT EXISTS pairings (
  pairing_hash TEXT PRIMARY KEY,           -- sha256 of the browser's pairing secret
  code         TEXT NOT NULL UNIQUE,
  sender_id    TEXT,
  user_agent   TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);

-- A paired browser: its session cookie's hash, and whose sends it makes.
CREATE TABLE IF NOT EXISTS browsers (
  browser_id   TEXT PRIMARY KEY,           -- public id, for the app's list and Remove
  session_hash TEXT NOT NULL UNIQUE,
  sender_id    TEXT NOT NULL,
  label        TEXT NOT NULL DEFAULT '',   -- "Chrome on Mac"
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_browsers_sender ON browsers(sender_id);

-- Whose link this is, so sealing it can count against that sender. Never
-- serialized to recipients.
ALTER TABLE transfers ADD COLUMN sender_id TEXT;
