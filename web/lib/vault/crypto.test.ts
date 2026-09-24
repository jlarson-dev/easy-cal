import { describe, expect, it } from "vitest";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  createVault,
  decryptVault,
  encryptVault,
  MIN_PASSPHRASE_LENGTH,
  unlockVault,
  wipeDek,
  wrapDekWithPrf,
} from "./crypto";
import { createEmptyVaultDocument } from "./document";

describe("base64url encoding", () => {
  it("round-trips without Node's base64url Buffer encoding", () => {
    const originalToString = Buffer.prototype.toString;

    Buffer.prototype.toString = function (encoding?: BufferEncoding) {
      if (encoding === "base64url") {
        throw new TypeError("Unknown encoding: base64url");
      }
      return originalToString.call(this, encoding);
    };

    try {
      const bytes = new Uint8Array([0, 1, 250, 255, 10]);
      const encoded = bytesToBase64Url(bytes);
      expect(encoded).not.toMatch(/[+/=]/);
      expect(Array.from(base64UrlToBytes(encoded))).toEqual(Array.from(bytes));
    } finally {
      Buffer.prototype.toString = originalToString;
    }
  });
});

describe("createVault", () => {
  it("rejects passphrases shorter than the minimum", async () => {
    await expect(
      createVault({
        userId: "user_test",
        passphrase: "short",
      }),
    ).rejects.toThrow(/at least 12 characters/i);
  });

  it("returns wrapped keys, ciphertext, and a recovery key", async () => {
    const result = await createVault({
      userId: "user_test",
      passphrase: "a-strong-passphrase",
    });

    expect(result.recoveryKey).toMatch(/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/);
    expect(result.encrypted.wrappedDeks.some((w) => w.kind === "passphrase")).toBe(
      true,
    );
    expect(result.encrypted.wrappedDeks.some((w) => w.kind === "recovery")).toBe(
      true,
    );
    expect(result.encrypted.ciphertextB64.length).toBeGreaterThan(0);
    expect(result.encrypted.nonceB64.length).toBeGreaterThan(0);
  });
});

describe("unlock and decrypt", () => {
  it("unlocks with the passphrase and decrypts an empty vault", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });

    const dek = await unlockVault(created.encrypted, {
      kind: "passphrase",
      secret: "a-strong-passphrase",
    });
    const document = await decryptVault(
      created.encrypted,
      dek,
      "user_alice",
    );

    expect(document.schemaVersion).toBe(1);
    expect(document.students).toEqual({});
    expect(document.subjects).toContain("Math");
  });

  it("unlocks with the recovery key", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });

    const dek = await unlockVault(created.encrypted, {
      kind: "recovery",
      secret: created.recoveryKey,
    });
    const document = await decryptVault(
      created.encrypted,
      dek,
      "user_alice",
    );

    expect(document.savedSchedules).toEqual([]);
  });

  it("fails to unlock with the wrong passphrase", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });

    await expect(
      unlockVault(created.encrypted, {
        kind: "passphrase",
        secret: "the-wrong-passphrase",
      }),
    ).rejects.toThrow(/could not unlock/i);
  });

  it("does not put student names in ciphertext", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });
    const dek = await unlockVault(created.encrypted, {
      kind: "passphrase",
      secret: "a-strong-passphrase",
    });
    const document = createEmptyVaultDocument();
    document.students["Jordan Kid"] = {
      blockedTimes: [
        { day: "Monday", start: "09:00", end: "10:00", label: "school" },
      ],
      canOverlap: [],
    };

    const encrypted = await encryptVault(document, dek, "user_alice", created.encrypted);
    const payload = new TextDecoder().decode(
      base64UrlToBytes(encrypted.ciphertextB64),
    );

    expect(payload).not.toContain("Jordan Kid");
    expect(payload).not.toContain("school");
  });
});

describe("constants", () => {
  it("requires a 12-character passphrase", () => {
    expect(MIN_PASSPHRASE_LENGTH).toBe(12);
  });
});

describe("passkey PRF wrapping", () => {
  it("wraps the DEK with PRF output and unlocks without the passphrase", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });
    const prfOutput = new Uint8Array(32).fill(7);
    const credentialId = new Uint8Array([1, 2, 3, 4]);
    const prfSalt = new Uint8Array(32).fill(9);

    const wrapped = await wrapDekWithPrf(
      created.dek,
      prfOutput,
      credentialId,
      prfSalt,
    );
    expect(wrapped.kind).toBe("prf");
    expect(wrapped.credentialIdB64).toBeTruthy();

    const withPrf = {
      ...created.encrypted,
      wrappedDeks: [...created.encrypted.wrappedDeks, wrapped],
    };

    const dek = await unlockVault(withPrf, { kind: "prf", prfOutput });
    expect(Array.from(dek)).toEqual(Array.from(created.dek));
  });

  it("fails PRF unlock with the wrong authenticator output", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });
    const wrapped = await wrapDekWithPrf(
      created.dek,
      new Uint8Array(32).fill(7),
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array(32).fill(9),
    );

    await expect(
      unlockVault(
        { ...created.encrypted, wrappedDeks: [wrapped] },
        { kind: "prf", prfOutput: new Uint8Array(32).fill(3) },
      ),
    ).rejects.toThrow(/could not unlock/i);
  });

  it("accepts PRF output that is not exactly 32 bytes", async () => {
    const created = await createVault({
      userId: "user_alice",
      passphrase: "a-strong-passphrase",
    });
    const prfOutput = new Uint8Array(64).fill(11);
    const wrapped = await wrapDekWithPrf(
      created.dek,
      prfOutput,
      new Uint8Array([9, 8, 7]),
      new Uint8Array(32).fill(2),
    );
    const dek = await unlockVault(
      { ...created.encrypted, wrappedDeks: [wrapped] },
      { kind: "prf", prfOutput },
    );
    expect(Array.from(dek)).toEqual(Array.from(created.dek));
  });

  it("zeros the DEK bytes on wipe", () => {
    const dek = new Uint8Array([1, 2, 3, 4]);
    wipeDek(dek);
    expect(Array.from(dek)).toEqual([0, 0, 0, 0]);
    wipeDek(null);
  });
});
