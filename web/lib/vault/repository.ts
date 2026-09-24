import { base64UrlToBytes, bytesToBase64Url } from "./crypto";
import { getSql } from "../db";
import type { EncryptedVault } from "./types";
import type { VaultWire } from "./payload";

type VaultRow = {
  user_id: string;
  schema_version: number;
  crypto_version: number;
  kdf_params: EncryptedVault["kdfParams"];
  wrapped_deks: EncryptedVault["wrappedDeks"];
  ciphertext: Uint8Array | Buffer | string;
  nonce: Uint8Array | Buffer | string;
  updated_at: string | Date;
  revision: string | number;
};

function toBytes(value: Uint8Array | Buffer | string): Uint8Array {
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : value;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  return new Uint8Array(value);
}

function rowToWire(row: VaultRow): VaultWire {
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at);
  return {
    schemaVersion: row.schema_version as 1,
    cryptoVersion: Number(row.crypto_version),
    kdfParams: row.kdf_params,
    wrappedDeks: row.wrapped_deks,
    ciphertextB64: bytesToBase64Url(toBytes(row.ciphertext)),
    nonceB64: bytesToBase64Url(toBytes(row.nonce)),
    revision: Number(row.revision),
    updatedAt,
  };
}

export async function getVaultRow(userId: string): Promise<VaultWire | null> {
  const sql = getSql();
  const rows = (await sql`
    WITH config AS (
      SELECT set_config('app.clerk_user_id', ${userId}, true)
    )
    SELECT vaults.user_id, schema_version, crypto_version, kdf_params, wrapped_deks,
           ciphertext, nonce, updated_at, revision
    FROM vaults, config
    WHERE user_id = ${userId}
  `) as VaultRow[];
  return rows[0] ? rowToWire(rows[0]) : null;
}

export async function insertVault(
  userId: string,
  vault: EncryptedVault,
): Promise<VaultWire> {
  const sql = getSql();
  const ciphertext = Buffer.from(base64UrlToBytes(vault.ciphertextB64));
  const nonce = Buffer.from(base64UrlToBytes(vault.nonceB64));
  const rows = (await sql`
    WITH config AS (
      SELECT set_config('app.clerk_user_id', ${userId}, true)
    )
    INSERT INTO vaults (
      user_id, schema_version, crypto_version, kdf_params, wrapped_deks,
      ciphertext, nonce, updated_at, revision
    )
    SELECT
      ${userId}, ${vault.schemaVersion}, ${vault.cryptoVersion},
      ${JSON.stringify(vault.kdfParams)}::jsonb, ${JSON.stringify(vault.wrappedDeks)}::jsonb,
      ${ciphertext}, ${nonce}, NOW(), 1
    FROM config
    RETURNING user_id, schema_version, crypto_version, kdf_params, wrapped_deks,
              ciphertext, nonce, updated_at, revision
  `) as VaultRow[];
  if (!rows[0]) {
    throw new Error("not_found");
  }
  return rowToWire(rows[0]);
}

export async function updateVault(
  userId: string,
  vault: EncryptedVault,
  expectedRevision: number,
): Promise<VaultWire | null> {
  const sql = getSql();
  const ciphertext = Buffer.from(base64UrlToBytes(vault.ciphertextB64));
  const nonce = Buffer.from(base64UrlToBytes(vault.nonceB64));
  const rows = (await sql`
    WITH config AS (
      SELECT set_config('app.clerk_user_id', ${userId}, true)
    )
    UPDATE vaults
    SET schema_version = ${vault.schemaVersion},
        crypto_version = ${vault.cryptoVersion},
        kdf_params = ${JSON.stringify(vault.kdfParams)}::jsonb,
        wrapped_deks = ${JSON.stringify(vault.wrappedDeks)}::jsonb,
        ciphertext = ${ciphertext},
        nonce = ${nonce},
        updated_at = NOW(),
        revision = revision + 1
    FROM config
    WHERE vaults.user_id = ${userId} AND vaults.revision = ${expectedRevision}
    RETURNING vaults.user_id, schema_version, crypto_version, kdf_params, wrapped_deks,
              ciphertext, nonce, updated_at, revision
  `) as VaultRow[];
  return rows[0] ? rowToWire(rows[0]) : null;
}

export async function deleteVault(userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    WITH config AS (
      SELECT set_config('app.clerk_user_id', ${userId}, true)
    )
    DELETE FROM vaults USING config WHERE user_id = ${userId}
  `;
}
