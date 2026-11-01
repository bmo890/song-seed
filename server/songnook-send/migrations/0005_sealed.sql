-- End-to-end sealed parcels (docs/product-plan/send-e2e-encryption.md). A
-- sealed parcel's files and envelope (title, sender, note, file names) are
-- SNS1-sealed on the sender's device with a key only the link carries.
ALTER TABLE transfers ADD COLUMN sealed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transfers ADD COLUMN sealed_meta TEXT;
