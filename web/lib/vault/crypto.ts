import { argon2id } from "hash-wasm";
import { createEmptyVaultDocument } from "./document";
import {
  CRYPTO_VERSION,
  KDF_PARAMS,
  MIN_PASSPHRASE_LENGTH,
  SCHEMA_VERSION,
  type EncryptedVault,
  type UnlockSecret,
  type VaultDocument,
  type WrappedDek,
} from "./types";

export { MIN_PASSPHRASE_LENGTH } from "./types";

const DEK_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;
const RECOVERY_KEY_BYTES = 24;

function getCrypto(): Crypto {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.subtle) {
    throw new Error("Web Crypto is not available");
  }
  return cryptoRef;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return getCrypto().getRandomValues(new Uint8Array(length));
}

function asCryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function formatRecoveryKey(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0").toUpperCase(),
  ).join("");
  return hex.match(/.{1,6}/g)?.join("-") ?? hex;
}

export function parseRecoveryKey(value: string): string {
  return value.replaceAll("-", "").replaceAll(/\s+/g, "").toUpperCase();
}

async function deriveWrappingKey(
  secret: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const hash = await argon2id({
    password: secret,
    salt,
    parallelism: KDF_PARAMS.parallelism,
    iterations: KDF_PARAMS.iterations,
    memorySize: KDF_PARAMS.memorySize,
    hashLength: KDF_PARAMS.hashLength,
    outputType: "binary",
  });

  return getCrypto().subtle.importKey(
    "raw",
    asCryptoBytes(hash),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function importAesGcmKey(bytes: Uint8Array): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    "raw",
    asCryptoBytes(bytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function prfWrappingKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const digest = await getCrypto().subtle.digest(
    "SHA-256",
    asCryptoBytes(prfOutput),
  );
  return importAesGcmKey(new Uint8Array(digest));
}

async function wrapDek(
  dek: Uint8Array,
  kind: "passphrase" | "recovery",
  secret: string,
): Promise<WrappedDek> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrappingKey = await deriveWrappingKey(secret, salt);
  const wrapped = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    asCryptoBytes(dek),
  );

  return {
    kind,
    saltB64: bytesToBase64Url(salt),
    ivB64: bytesToBase64Url(iv),
    wrappedDekB64: bytesToBase64Url(new Uint8Array(wrapped)),
  };
}

async function unwrapDek(
  wrapped: WrappedDek,
  secret: string,
): Promise<Uint8Array> {
  const wrappingKey = await deriveWrappingKey(
    secret,
    base64UrlToBytes(wrapped.saltB64),
  );

  try {
    const dek = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: asCryptoBytes(base64UrlToBytes(wrapped.ivB64)) },
      wrappingKey,
      asCryptoBytes(base64UrlToBytes(wrapped.wrappedDekB64)),
    );
    return new Uint8Array(dek);
  } catch {
    throw new Error("Could not unlock vault");
  }
}

function vaultAad(userId: string): Uint8Array {
  return new TextEncoder().encode(`${userId}|vault|${SCHEMA_VERSION}`);
}

async function importDek(dek: Uint8Array): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    "raw",
    asCryptoBytes(dek),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVault(
  document: VaultDocument,
  dek: Uint8Array,
  userId: string,
  previous: Pick<EncryptedVault, "wrappedDeks" | "kdfParams" | "cryptoVersion">,
): Promise<EncryptedVault> {
  const nonce = randomBytes(IV_BYTES);
  const key = await importDek(dek);
  const plaintext = new TextEncoder().encode(JSON.stringify(document));
  const ciphertext = await getCrypto().subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: asCryptoBytes(vaultAad(userId)),
    },
    key,
    plaintext,
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    cryptoVersion: previous.cryptoVersion,
    kdfParams: previous.kdfParams,
    wrappedDeks: previous.wrappedDeks,
    ciphertextB64: bytesToBase64Url(new Uint8Array(ciphertext)),
    nonceB64: bytesToBase64Url(nonce),
  };
}

export async function decryptVault(
  encrypted: EncryptedVault,
  dek: Uint8Array,
  userId: string,
): Promise<VaultDocument> {
  const key = await importDek(dek);
  try {
    const plaintext = await getCrypto().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asCryptoBytes(base64UrlToBytes(encrypted.nonceB64)),
        additionalData: asCryptoBytes(vaultAad(userId)),
      },
      key,
      asCryptoBytes(base64UrlToBytes(encrypted.ciphertextB64)),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as VaultDocument;
  } catch {
    throw new Error("Could not decrypt vault");
  }
}

export async function wrapDekWithPrf(
  dek: Uint8Array,
  prfOutput: Uint8Array,
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<WrappedDek> {
  const iv = randomBytes(IV_BYTES);
  const wrappingKey = await prfWrappingKey(prfOutput);
  const wrapped = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    asCryptoBytes(dek),
  );

  return {
    kind: "prf",
    saltB64: bytesToBase64Url(prfSalt),
    ivB64: bytesToBase64Url(iv),
    wrappedDekB64: bytesToBase64Url(new Uint8Array(wrapped)),
    credentialIdB64: bytesToBase64Url(credentialId),
  };
}

async function unwrapDekWithPrf(
  wrapped: WrappedDek,
  prfOutput: Uint8Array,
): Promise<Uint8Array> {
  const wrappingKey = await prfWrappingKey(prfOutput);
  try {
    const dek = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: asCryptoBytes(base64UrlToBytes(wrapped.ivB64)) },
      wrappingKey,
      asCryptoBytes(base64UrlToBytes(wrapped.wrappedDekB64)),
    );
    return new Uint8Array(dek);
  } catch {
    throw new Error("Could not unlock vault");
  }
}

export function wipeDek(dek: Uint8Array | null): void {
  dek?.fill(0);
}

export async function unlockVault(
  encrypted: EncryptedVault,
  secret: UnlockSecret,
): Promise<Uint8Array> {
  const wrapped = encrypted.wrappedDeks.find((item) => item.kind === secret.kind);
  if (!wrapped) {
    throw new Error("Could not unlock vault");
  }

  if (secret.kind === "prf") {
    return unwrapDekWithPrf(wrapped, secret.prfOutput);
  }

  const normalized =
    secret.kind === "recovery" ? parseRecoveryKey(secret.secret) : secret.secret;
  return unwrapDek(wrapped, normalized);
}

export async function createVault(input: {
  userId: string;
  passphrase: string;
}): Promise<{ encrypted: EncryptedVault; recoveryKey: string; dek: Uint8Array }> {
  if (input.passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
    );
  }

  const dek = randomBytes(DEK_BYTES);
  const recoveryBytes = randomBytes(RECOVERY_KEY_BYTES);
  const recoveryKey = formatRecoveryKey(recoveryBytes);

  const wrappedDeks = await Promise.all([
    wrapDek(dek, "passphrase", input.passphrase),
    wrapDek(dek, "recovery", parseRecoveryKey(recoveryKey)),
  ]);

  const encrypted = await encryptVault(
    createEmptyVaultDocument(),
    dek,
    input.userId,
    {
      cryptoVersion: CRYPTO_VERSION,
      kdfParams: KDF_PARAMS,
      wrappedDeks,
    },
  );

  return { encrypted, recoveryKey, dek };
}
