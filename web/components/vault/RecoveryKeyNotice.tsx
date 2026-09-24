"use client";

import { FormEvent, useState } from "react";

export function RecoveryKeyNotice({
  recoveryKey,
  onConfirm,
}: {
  recoveryKey: string;
  onConfirm: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!saved) {
      return;
    }
    onConfirm();
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadKey() {
    const blob = new Blob(
      [`Easy Cal vault recovery key\n\n${recoveryKey}\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "easy-cal-recovery-key.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg rounded-lg bg-card p-8">
      <h2 className="text-2xl font-semibold">Save your recovery key</h2>
      <p className="mt-3 text-sm leading-6 text-foreground/75">
        This is the only way to open your vault if you forget the passphrase
        and have not registered a passkey. Easy Cal cannot recover student
        data without it. Store it offline — this screen will not be shown again.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-md bg-black/5 p-4 text-center text-sm font-mono tracking-wide">
        {recoveryKey}
      </pre>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyKey()}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5"
        >
          {copied ? "Copied" : "Copy key"}
        </button>
        <button
          type="button"
          onClick={downloadKey}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5"
        >
          Download .txt
        </button>
      </div>
      <label className="mt-6 flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="mt-1"
        />
        I have stored this recovery key somewhere I will not lose.
      </label>
      <button
        type="submit"
        disabled={!saved}
        className="mt-6 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        Continue
      </button>
    </form>
  );
}
