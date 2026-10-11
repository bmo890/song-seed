-- What the sender says the parcel IS (2026-10-11): loose files, or a running
-- order the app should rebuild as a playlist or a setlist. The order itself
-- was always carried by items.sort_order; this names the intent.
ALTER TABLE transfers ADD COLUMN share_kind TEXT NOT NULL DEFAULT 'clips';
