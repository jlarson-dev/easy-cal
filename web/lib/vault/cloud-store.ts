import type { EncryptedVault } from "./types";
import type { VaultWire } from "./payload";

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "not_found";
  } catch {
    return "not_found";
  }
}

export async function fetchVault(): Promise<VaultWire | null> {
  const response = await fetch("/api/vault", { credentials: "include" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as VaultWire;
}

export async function putVault(
  vault: EncryptedVault,
  revision: number,
): Promise<VaultWire> {
  const response = await fetch("/api/vault", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "If-Match": String(revision),
    },
    body: JSON.stringify({
      schemaVersion: vault.schemaVersion,
      cryptoVersion: vault.cryptoVersion,
      kdfParams: vault.kdfParams,
      wrappedDeks: vault.wrappedDeks,
      ciphertextB64: vault.ciphertextB64,
      nonceB64: vault.nonceB64,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as VaultWire;
}
