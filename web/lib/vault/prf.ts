import { base64UrlToBytes, wrapDekWithPrf } from "./crypto";
import type { WrappedDek } from "./types";

type PrfExtensionResults = {
  prf?: {
    enabled?: boolean;
    results?: {
      first?: ArrayBuffer;
    };
  };
};

export async function isPrfAvailable(): Promise<boolean> {
  if (typeof PublicKeyCredential === "undefined") {
    return false;
  }
  try {
    const caps = await PublicKeyCredential.getClientCapabilities?.();
    if (caps && typeof caps === "object") {
      const record = caps as Record<string, unknown>;
      if (record.prf === true) {
        return true;
      }
      const extensions = record.extensions;
      if (
        extensions &&
        typeof extensions === "object" &&
        (extensions as { prf?: boolean }).prf === true
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function createPrfWrap(
  dek: Uint8Array,
  userId: string,
): Promise<WrappedDek> {
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "Easy Cal", id: location.hostname },
      user: {
        id: userIdBytes,
        name: "Easy Cal vault",
        displayName: "Easy Cal vault",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60_000,
      extensions: { prf: {} },
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey is not available");
  }

  const created = credential.getClientExtensionResults() as PrfExtensionResults;
  if (!created.prf?.enabled) {
    throw new Error("This authenticator cannot unlock the vault with a passkey");
  }

  const prfOutput = await evaluatePrf(new Uint8Array(credential.rawId), prfSalt);
  return wrapDekWithPrf(dek, prfOutput, new Uint8Array(credential.rawId), prfSalt);
}

export async function evaluatePrfFromWrap(wrapped: WrappedDek): Promise<Uint8Array> {
  if (wrapped.kind !== "prf" || !wrapped.credentialIdB64) {
    throw new Error("Could not unlock vault");
  }
  return evaluatePrf(
    base64UrlToBytes(wrapped.credentialIdB64),
    base64UrlToBytes(wrapped.saltB64),
  );
}

async function evaluatePrf(
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<Uint8Array> {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [
        {
          type: "public-key",
          id: Uint8Array.from(credentialId),
        },
      ],
      userVerification: "required",
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: Uint8Array.from(prfSalt) } },
      },
    },
  });

  if (!(assertion instanceof PublicKeyCredential)) {
    throw new Error("Could not unlock vault");
  }

  const results = assertion.getClientExtensionResults() as PrfExtensionResults;
  const first = results.prf?.results?.first;
  if (!first) {
    throw new Error("Could not unlock vault");
  }
  return new Uint8Array(first);
}
