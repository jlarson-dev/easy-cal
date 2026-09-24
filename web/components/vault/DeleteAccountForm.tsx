"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ACCOUNT_DELETE_COPY } from "@/lib/legal/copy";

export function DeleteAccountForm() {
  const router = useRouter();
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!acked) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Could not delete account");
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not delete account");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg rounded-lg bg-card p-8">
      <h2 className="text-2xl font-semibold">Delete account</h2>
      <p className="mt-3 text-sm leading-6 text-foreground/75">
        {ACCOUNT_DELETE_COPY.warning}
      </p>
      <p className="mt-3 text-sm leading-6 text-foreground/75">
        Export Students JSON from the unlocked vault first if you still need a
        copy.
      </p>
      <label className="mt-6 flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          className="mt-1"
          checked={acked}
          onChange={(event) => setAcked(event.target.checked)}
        />
        I understand this cannot be undone.
      </label>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={!acked || busy}
        className="mt-6 rounded-md bg-red-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
      >
        {busy ? "Deleting…" : ACCOUNT_DELETE_COPY.confirmLabel}
      </button>
    </form>
  );
}
