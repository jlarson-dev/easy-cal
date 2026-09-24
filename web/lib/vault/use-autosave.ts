"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { fetchVault, putVault } from "./cloud-store";
import { encryptVault } from "./crypto";
import { saveEncryptedVault } from "./local-store";
import type { EncryptedVault, VaultDocument } from "./types";
import type { VaultWire } from "./payload";

export type SyncStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

const DEBOUNCE_MS = 500;

export function useVaultAutosave({
  userId,
  dekRef,
  envelopeRef,
  revisionRef,
  enabled,
  onSaved,
}: {
  userId: string | undefined;
  dekRef: MutableRefObject<Uint8Array | null>;
  envelopeRef: MutableRefObject<EncryptedVault | null>;
  revisionRef: MutableRefObject<number>;
  enabled: boolean;
  onSaved: (vault: VaultWire) => void;
}) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const documentRef = useRef<VaultDocument | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const userIdRef = useRef(userId);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    enabledRef.current = enabled;
    userIdRef.current = userId;
    onSavedRef.current = onSaved;
  }, [enabled, onSaved, userId]);

  async function flush() {
    const activeUserId = userIdRef.current;
    if (!enabledRef.current || !activeUserId) {
      return;
    }
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    const document = documentRef.current;
    const dek = dekRef.current;
    const envelope = envelopeRef.current;
    if (!document || !dek || !envelope) {
      return;
    }

    inFlightRef.current = true;
    setStatus("saving");
    try {
      const encrypted = await encryptVault(document, dek, activeUserId, envelope);
      let saved: VaultWire;
      let conflict = false;
      try {
        saved = await putVault(encrypted, revisionRef.current);
      } catch (err) {
        if (!(err instanceof Error) || err.message !== "conflict") {
          throw err;
        }
        const remote = await fetchVault();
        if (!remote) {
          throw err;
        }
        saved = await putVault(encrypted, remote.revision);
        conflict = true;
      }

      revisionRef.current = saved.revision;
      envelopeRef.current = saved;
      saveEncryptedVault(activeUserId, saved);
      onSavedRef.current(saved);
      setStatus(conflict ? "conflict" : "saved");
    } catch {
      setStatus("error");
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        await flush();
      }
    }
  }

  function queue(document: VaultDocument) {
    documentRef.current = document;
    setStatus("pending");
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      void flush();
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    const onHide = () => {
      void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
    // flush reads latest refs; bind once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { queue, flush, status };
}
