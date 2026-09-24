"use client";

import { FormEvent, useState } from "react";
import type { UnlockSecret } from "@/lib/vault/types";

export function UnlockVaultForm({
  busy,
  error,
  hasPasskey,
  onUnlock,
  onUnlockPasskey,
}: {
  busy: boolean;
  error: string | null;
  hasPasskey?: boolean;
  onUnlock: (secret: Extract<UnlockSecret, { secret: string }>) => Promise<void>;
  onUnlockPasskey?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");
  const [secret, setSecret] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onUnlock({ kind: mode, secret });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg rounded-lg bg-card p-8">
      <h2 className="text-2xl font-semibold">Unlock your vault</h2>
      <p className="mt-3 text-sm leading-6 text-foreground/75">
        Sign-in only identifies you. Student data stays locked until you use a
        passkey, vault passphrase, or recovery key.
      </p>

      {hasPasskey && onUnlockPasskey ? (
        <button
          type="button"
          onClick={() => void onUnlockPasskey()}
          disabled={busy}
          className="mt-6 w-full rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "Unlocking…" : "Unlock with passkey"}
        </button>
      ) : null}

      <div className="mt-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("passphrase")}
          className={`rounded-md px-3 py-1.5 ${
            mode === "passphrase" ? "bg-brand text-white" : "bg-black/5"
          }`}
        >
          Passphrase
        </button>
        <button
          type="button"
          onClick={() => setMode("recovery")}
          className={`rounded-md px-3 py-1.5 ${
            mode === "recovery" ? "bg-brand text-white" : "bg-black/5"
          }`}
        >
          Recovery key
        </button>
      </div>

      <label className="mt-4 block text-sm font-medium">
        {mode === "passphrase" ? "Vault passphrase" : "Recovery key"}
        <input
          type={mode === "passphrase" ? "password" : "text"}
          autoComplete={mode === "passphrase" ? "current-password" : "off"}
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="mt-2 w-full rounded-md border border-black/10 px-3 py-2 font-mono"
          required
        />
      </label>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Unlocking…" : "Unlock vault"}
      </button>
    </form>
  );
}
