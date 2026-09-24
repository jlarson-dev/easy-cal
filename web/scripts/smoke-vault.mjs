import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(url);
const userId = "user_smoke_test";
const ciphertext = Buffer.from("cipher-bytes");
const nonce = Buffer.from("nonce-bytes-12");
const kdf = JSON.stringify({ algorithm: "argon2id" });
const wrapped = JSON.stringify([{ kind: "passphrase" }]);

await sql`
  WITH config AS (
    SELECT set_config('app.clerk_user_id', ${userId}, true)
  )
  INSERT INTO vaults (
    user_id, schema_version, crypto_version, kdf_params, wrapped_deks,
    ciphertext, nonce, updated_at, revision
  )
  SELECT
    ${userId}, 1, 1, ${kdf}::jsonb, ${wrapped}::jsonb,
    ${ciphertext}, ${nonce}, NOW(), 1
  FROM config
`;

const rows = await sql`
  WITH config AS (
    SELECT set_config('app.clerk_user_id', ${userId}, true)
  )
  SELECT user_id, revision FROM vaults, config WHERE user_id = ${userId}
`;

const leaked = JSON.stringify(rows).includes("Secret Student");
await sql`
  WITH config AS (
    SELECT set_config('app.clerk_user_id', ${userId}, true)
  )
  DELETE FROM vaults USING config WHERE user_id = ${userId}
`;

if (!rows[0] || Number(rows[0].revision) !== 1) {
  throw new Error("vault round-trip failed");
}
if (leaked) {
  throw new Error("plaintext leak");
}
console.log("vault round-trip ok");
