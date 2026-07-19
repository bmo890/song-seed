-- Keep the public transfer id as the recipient capability, but require a
-- separate secret for draft mutation (register items / finalize).
ALTER TABLE transfers ADD COLUMN upload_token_hash TEXT;
