"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Workspace } from "@/components/schedule/Workspace";
import { CreateVaultForm } from "@/components/vault/CreateVaultForm";
import { RecoveryKeyNotice } from "@/components/vault/RecoveryKeyNotice";
import { RegisterPasskeyBanner } from "@/components/vault/RegisterPasskeyBanner";
import { UnlockVaultForm } from "@/components/vault/UnlockVaultForm";
import { fetchVault, putVault } from "@/lib/vault/cloud-store";
import { createVault, decryptVault, unlockVault, wipeDek } from "@/lib/vault/crypto";
import {
  loadEncryptedVault,
  saveEncryptedVault,
} from "@/lib/vault/local-store";
import { createPrfWrap, evaluatePrfFromWrap, isPrfAvailable } from "@/lib/vault/prf";
import { useVaultAutosave } from "@/lib/vault/use-autosave";
import type { EncryptedVault, UnlockSecret, VaultDocument } from "@/lib/vault/types";

const IDLE_LOCK_MS = 15 * 60 * 1000;

function emptySubscribe() {
  return () => {};
}

export function VaultGate() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [cloudVault, setCloudVault] = useState<EncryptedVault | null | undefined>(
    undefined,
  );
  const [document, setDocument] = useState<VaultDocument | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prfAvailable, setPrfAvailable] = useState(false);
  const [hidePrfOffer, setHidePrfOffer] = useState(false);
  const dekRef = useRef<Uint8Array | null>(null);
  const lastActivityRef = useRef(0);
  const envelopeRef = useRef<EncryptedVault | null>(null);
  const revisionRef = useRef(0);

  const { queue, flush, status: syncStatus } = useVaultAutosave({
    userId,
    dekRef,
    envelopeRef,
    revisionRef,
    enabled: Boolean(document),
    onSaved: (saved) => {
      setCloudVault(saved);
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;

    fetchVault()
      .then(async (remote) => {
        if (cancelled) {
          return;
        }
        if (remote) {
          saveEncryptedVault(userId, remote);
          setCloudVault(remote);
          return;
        }
        const local = loadEncryptedVault(userId);
        if (local) {
          const migrated = await putVault(local, 0);
          if (!cancelled) {
            saveEncryptedVault(userId, migrated);
            setCloudVault(migrated);
          }
          return;
        }
        setCloudVault(null);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load vault");
        setCloudVault(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    void isPrfAvailable().then(setPrfAvailable);
  }, []);

  useEffect(() => {
    if (!cloudVault) {
      return;
    }
    envelopeRef.current = cloudVault;
    revisionRef.current = cloudVault.revision ?? 0;
  }, [cloudVault]);

  const encrypted = cloudVault ?? null;

  const status = !mounted || !isLoaded || !userId || cloudVault === undefined
    ? "loading"
    : recoveryKey
      ? "recovery"
      : document
        ? "unlocked"
        : encrypted
          ? "locked"
          : "create";

  const lock = useCallback(() => {
    void flush().finally(() => {
      wipeDek(dekRef.current);
      dekRef.current = null;
      setDocument(null);
    });
  }, [flush]);

  useEffect(() => {
    if (status !== "unlocked") {
      return;
    }

    lastActivityRef.current = Date.now();
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_LOCK_MS) {
        lock();
      }
    }, 10_000);

    window.addEventListener("pointerdown", markActivity);
    window.addEventListener("keydown", markActivity);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", markActivity);
      window.removeEventListener("keydown", markActivity);
    };
  }, [status, lock]);

  async function handleCreate(passphrase: string) {
    if (!userId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createVault({ userId, passphrase });
      const saved = await putVault(created.encrypted, 0);
      saveEncryptedVault(userId, saved);
      dekRef.current = created.dek;
      setCloudVault(saved);
      setRecoveryKey(created.recoveryKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create vault");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(secret: UnlockSecret) {
    if (!userId || !encrypted) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dek = await unlockVault(encrypted, secret);
      const nextDocument = await decryptVault(encrypted, dek, userId);
      dekRef.current = dek;
      setDocument(nextDocument);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock vault");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlockPasskey() {
    if (!encrypted) {
      return;
    }
    const wrapped = encrypted.wrappedDeks.find((item) => item.kind === "prf");
    if (!wrapped) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const prfOutput = await evaluatePrfFromWrap(wrapped);
      await handleUnlock({ kind: "prf", prfOutput });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock vault");
      setBusy(false);
    }
  }

  async function handleRegisterPasskey() {
    if (!userId || !dekRef.current || !encrypted) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const wrap = await createPrfWrap(dekRef.current, userId);
      const next = {
        ...encrypted,
        wrappedDeks: [
          ...encrypted.wrappedDeks.filter((item) => item.kind !== "prf"),
          wrap,
        ],
      };
      const saved = await putVault(next, revisionRef.current);
      saveEncryptedVault(userId, saved);
      setCloudVault(saved);
      setHidePrfOffer(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register passkey");
    } finally {
      setBusy(false);
    }
  }

  function handleRecoveryConfirmed() {
    if (!encrypted || !dekRef.current || !userId) {
      return;
    }
    void decryptVault(encrypted, dekRef.current, userId).then((nextDocument) => {
      setDocument(nextDocument);
      setRecoveryKey(null);
    });
  }

  const persistDocument = useCallback(
    (next: VaultDocument) => {
      setDocument(next);
      queue(next);
    },
    [queue],
  );

  const locked = status !== "unlocked";
  const hasPasskey = Boolean(encrypted?.wrappedDeks.some((item) => item.kind === "prf"));
  const showPrfOffer =
    status === "unlocked" && prfAvailable && !hasPasskey && !hidePrfOffer;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        locked={locked}
        onLock={status === "unlocked" ? lock : undefined}
        syncStatus={status === "unlocked" ? syncStatus : undefined}
      />
      {showPrfOffer ? (
        <RegisterPasskeyBanner
          busy={busy}
          error={error}
          onRegister={handleRegisterPasskey}
          onDismiss={() => setHidePrfOffer(true)}
        />
      ) : null}
      {status === "unlocked" && document ? (
        <Workspace document={document} onChange={persistDocument} />
      ) : (
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
          {status === "loading" && (
            <p className="text-center text-foreground/70">Loading your vault…</p>
          )}
          {status === "create" && (
            <CreateVaultForm busy={busy} error={error} onCreate={handleCreate} />
          )}
          {status === "recovery" && recoveryKey && (
            <RecoveryKeyNotice
              recoveryKey={recoveryKey}
              onConfirm={handleRecoveryConfirmed}
            />
          )}
          {status === "locked" && (
            <UnlockVaultForm
              busy={busy}
              error={error}
              hasPasskey={hasPasskey}
              onUnlock={handleUnlock}
              onUnlockPasskey={handleUnlockPasskey}
            />
          )}
        </main>
      )}
      <SiteFooter />
    </div>
  );
}
