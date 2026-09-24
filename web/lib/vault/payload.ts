import type { EncryptedVault } from "./types";

export const MAX_VAULT_BYTES = 4 * 1024 * 1024;

export type VaultWire = EncryptedVault & {
  revision: number;
  updatedAt?: string;
};

export type VaultWriteResult = "insert" | "update" | "conflict" | "precondition";

export function resolveVaultWrite(
  existingRevision: number | null,
  ifMatch: number | undefined,
): VaultWriteResult {
  if (existingRevision === null) {
    if (ifMatch === undefined || ifMatch === 0) {
      return "insert";
    }
    return "conflict";
  }
  if (ifMatch === undefined) {
    return "precondition";
  }
  if (ifMatch !== existingRevision) {
    return "conflict";
  }
  return "update";
}

export function parseIfMatch(header: string | null): number | undefined {
  if (header === null || header.trim() === "") {
    return undefined;
  }
  const value = header.replaceAll('"', "").trim();
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export function vaultWireFromEncrypted(
  encrypted: EncryptedVault,
  extras: { revision: number; updatedAt?: string } = {
    revision: encrypted.revision ?? 0,
  },
): VaultWire {
  return {
    schemaVersion: encrypted.schemaVersion,
    cryptoVersion: encrypted.cryptoVersion,
    kdfParams: encrypted.kdfParams,
    wrappedDeks: encrypted.wrappedDeks,
    ciphertextB64: encrypted.ciphertextB64,
    nonceB64: encrypted.nonceB64,
    revision: extras.revision,
    updatedAt: extras.updatedAt,
  };
}

export function isVaultWriteBody(value: unknown): value is EncryptedVault {
  if (!value || typeof value !== "object") {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    body.schemaVersion === 1 &&
    typeof body.cryptoVersion === "number" &&
    typeof body.ciphertextB64 === "string" &&
    typeof body.nonceB64 === "string" &&
    Array.isArray(body.wrappedDeks) &&
    typeof body.kdfParams === "object" &&
    body.kdfParams !== null
  );
}

export function vaultWriteTooLarge(value: EncryptedVault): boolean {
  return JSON.stringify(value).length > MAX_VAULT_BYTES;
}
