-- A feedback note may carry the address its writer asked to be answered at
-- (2026-11-15). Empty for an anonymous note; swept with the note after a year.
ALTER TABLE feedback ADD COLUMN reply_to TEXT NOT NULL DEFAULT '';
