"use client";

export function RegisterPasskeyBanner({
  busy,
  error,
  onRegister,
  onDismiss,
}: {
  busy: boolean;
  error: string | null;
  onRegister: () => Promise<void>;
  onDismiss: () => void;
}) {
  return (
    <div className="border-b border-black/10 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-foreground/80">
          This authenticator can unlock the vault with a passkey so you do not
          have to type the passphrase on this device.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onRegister()}
            disabled={busy}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {busy ? "Registering…" : "Register passkey"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5"
          >
            Not now
          </button>
        </div>
      </div>
      {error ? <p className="mx-auto mt-2 max-w-5xl text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
