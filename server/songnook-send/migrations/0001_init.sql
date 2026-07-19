-- Songnook Send — transfer + item metadata.
-- Files themselves are opaque bytes in R2; this DB is only the manifest.

CREATE TABLE IF NOT EXISTS transfers (
  transfer_id    TEXT PRIMARY KEY,          -- unguessable, URL-safe; THE identity + dedupe key
  title          TEXT NOT NULL DEFAULT '',
  sender_name    TEXT NOT NULL DEFAULT '',
  sender_user_id TEXT,                       -- ALWAYS present in the wire payload, null in v1 (accounts later)
  message        TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'finalized'
  size_total     INTEGER NOT NULL DEFAULT 0,     -- running sum of registered item sizes (bytes)
  created_at     INTEGER NOT NULL,          -- epoch ms
  expires_at     INTEGER NOT NULL           -- epoch ms; swept after
);

CREATE TABLE IF NOT EXISTS items (
  item_id        TEXT PRIMARY KEY,
  transfer_id    TEXT NOT NULL REFERENCES transfers(transfer_id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  mime_type      TEXT NOT NULL DEFAULT 'application/octet-stream',
  size           INTEGER NOT NULL DEFAULT 0,
  r2_key         TEXT NOT NULL,             -- object key in the R2 bucket
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_transfer ON items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfers_expiry ON transfers(expires_at);
