"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { SyncStatus } from "@/lib/vault/use-autosave";

function syncLabel(status: SyncStatus) {
  switch (status) {
    case "pending":
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "conflict":
      return "Saved (replaced newer copy)";
    case "error":
      return "Save failed";
    default:
      return null;
  }
}

export function AppHeader({
  onLock,
  locked,
  syncStatus,
}: {
  onLock?: () => void;
  locked: boolean;
  syncStatus?: SyncStatus;
}) {
  const label = syncStatus ? syncLabel(syncStatus) : null;
  return (
    <header className="flex items-center justify-between bg-brand px-6 py-4 text-white">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
          Easy Cal
        </p>
        <h1 className="text-xl font-semibold">Student Schedule Generator</h1>
      </div>
      <div className="flex items-center gap-3">
        {label ? (
          <span className="text-xs text-white/80" data-testid="sync-status">
            {label}
          </span>
        ) : null}
        {!locked && onLock ? (
          <button
            type="button"
            onClick={onLock}
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Lock vault
          </button>
        ) : null}
        <Link
          href="/account"
          className="rounded-md border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          Account
        </Link>
        <UserButton />
      </div>
    </header>
  );
}
