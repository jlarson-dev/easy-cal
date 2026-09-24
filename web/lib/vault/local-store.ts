import type { EncryptedVault } from "./types";

const storageKey = (userId: string) => `easy-cal.vault.${userId}`;

export function loadEncryptedVault(userId: string): EncryptedVault | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as EncryptedVault;
  } catch {
    return null;
  }
}

export function saveEncryptedVault(userId: string, vault: EncryptedVault): void {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(vault));
}
