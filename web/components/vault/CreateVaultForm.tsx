"use client";

import { FormEvent, useState } from "react";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/vault/crypto";

export function CreateVaultForm({
  busy,
  error,
  onCreate,
}: {
  busy: boolean;
  error: string | null;
  onCreate: (passphrase: string) => Promise<void>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [ackReset, setAckReset] = useState(false);
  const [ackRecovery, setAckRecovery] = useState(false);
  const [ackExport, setAckExport] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setLocalError(
        `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
      );
      return;
    }
    if (passphrase !== confirm) {
      setLocalError("Passphrases do not match");
      return;
    }
    if (!ackReset || !ackRecovery || !ackExport) {
      setLocalError("Please acknowledge the vault limitations below");
      return;
    }

    await onCreate(passphrase);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg rounded-lg bg-card p-8">
      <h2 className="text-2xl font-semibold">Create your vault</h2>
      <p className="mt-3 text-sm leading-6 text-foreground/75">
        This passphrase encrypts student names and schedules on your device
        before anything is stored. Easy Cal cannot reset it. You will also get
        a recovery key — store that offline.
      </p>

      <label className="mt-6 block text-sm font-medium">
        Vault passphrase
        <input
          type="password"
          autoComplete="new-password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          className="mt-2 w-full rounded-md border border-black/10 px-3 py-2"
          minLength={MIN_PASSPHRASE_LENGTH}
          required
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Confirm passphrase
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="mt-2 w-full rounded-md border border-black/10 px-3 py-2"
          required
        />
      </label>

      <fieldset className="mt-6 space-y-3 text-sm leading-6 text-foreground/80">
        <legend className="font-medium text-foreground">Before you continue</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={ackReset}
            onChange={(event) => setAckReset(event.target.checked)}
          />
          Easy Cal cannot reset or recover student data if I lose access.
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={ackRecovery}
            onChange={(event) => setAckRecovery(event.target.checked)}
          />
          The recovery key is the only backup if I forget this passphrase,
          unless I later register a passkey on this device.
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={ackExport}
            onChange={(event) => setAckExport(event.target.checked)}
          />
          Downloaded JSON, CSV, PNG, and PDF files are plaintext on this
          computer after unlock.
        </label>
      </fieldset>

      {(localError || error) && (
        <p className="mt-4 text-sm text-red-700">{localError || error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Creating vault…" : "Create vault"}
      </button>
    </form>
  );
}
