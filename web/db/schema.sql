CREATE TABLE IF NOT EXISTS vaults (
  user_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  crypto_version INTEGER NOT NULL,
  kdf_params JSONB NOT NULL,
  wrapped_deks JSONB NOT NULL,
  ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revision BIGINT NOT NULL DEFAULT 1
);

ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaults FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vaults_isolation ON vaults;
CREATE POLICY vaults_isolation ON vaults
  USING (user_id = current_setting('app.clerk_user_id', true))
  WITH CHECK (user_id = current_setting('app.clerk_user_id', true));
