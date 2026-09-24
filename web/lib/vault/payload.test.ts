import { describe, expect, it } from "vitest";
import { createVault, encryptVault, base64UrlToBytes } from "./crypto";
import { createEmptyVaultDocument } from "./document";
import {
  isVaultWriteBody,
  MAX_VAULT_BYTES,
  resolveVaultWrite,
  vaultWriteTooLarge,
  vaultWireFromEncrypted,
} from "./payload";

describe("vault wire payload", () => {
  it("does not include student names in the JSON sent to the server", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });
    const document = createEmptyVaultDocument();
    document.students["Secret Student"] = {
      blockedTimes: [
        { day: "Monday", start: "09:00", end: "10:00", label: "piano" },
      ],
      canOverlap: [],
    };

    const encrypted = await encryptVault(
      document,
      created.dek,
      "user_alice",
      created.encrypted,
    );
    const wire = vaultWireFromEncrypted(encrypted, { revision: 1 });
    const json = JSON.stringify(wire);

    expect(json).not.toContain("Secret Student");
    expect(json).not.toContain("piano");
    expect(wire.ciphertextB64.length).toBeGreaterThan(0);
    expect(wire.wrappedDeks.length).toBeGreaterThan(0);

    const ciphertextText = new TextDecoder().decode(
      base64UrlToBytes(wire.ciphertextB64),
    );
    expect(ciphertextText).not.toContain("Secret Student");
    expect(ciphertextText).not.toContain("piano");
  });
});

describe("resolveVaultWrite", () => {
  it("inserts when no row exists", () => {
    expect(resolveVaultWrite(null, 0)).toBe("insert");
    expect(resolveVaultWrite(null, undefined)).toBe("insert");
  });

  it("updates when If-Match matches the current revision", () => {
    expect(resolveVaultWrite(3, 3)).toBe("update");
  });

  it("conflicts when If-Match does not match", () => {
    expect(resolveVaultWrite(3, 2)).toBe("conflict");
    expect(resolveVaultWrite(null, 4)).toBe("conflict");
  });

  it("requires If-Match when a row already exists", () => {
    expect(resolveVaultWrite(1, undefined)).toBe("precondition");
  });

  it("rejects vault writes larger than 4 MB", () => {
    expect(MAX_VAULT_BYTES).toBe(4 * 1024 * 1024);
    expect(
      vaultWriteTooLarge({
        schemaVersion: 1,
        cryptoVersion: 1,
        kdfParams: { algorithm: "argon2id", memorySize: 1, iterations: 1, parallelism: 1, hashLength: 32 },
        wrappedDeks: [],
        ciphertextB64: "a".repeat(MAX_VAULT_BYTES),
        nonceB64: "n",
      }),
    ).toBe(true);
    expect(
      isVaultWriteBody({
        schemaVersion: 1,
        cryptoVersion: 1,
        kdfParams: {},
        wrappedDeks: [],
        ciphertextB64: "ok",
        nonceB64: "n",
      }),
    ).toBe(true);
  });
});
