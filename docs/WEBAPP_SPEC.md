# Easy Cal Web App — Product & Architecture Spec

**Status:** Draft for review  
**Date:** 2026-09-24  
**Goal:** Replace the desktop (PyInstaller + pywebview) distribution with a hosted web app that keeps today’s tutoring-scheduler behavior, adds Clerk sign-in, persists each user’s students and schedules in the cloud, and stores student data so that **operators looking at databases, backups, or logs cannot read it**.

This spec is the source of truth for the migration. It describes what to build, what must stay the same, and the security model that makes “admins cannot see student data in storage” actually true.

---

## 1. Problem

Easy Cal is a local Student Schedule Generator: a React UI plus a FastAPI backend that writes JSON files to disk (or `%APPDATA%\StudentScheduleGenerator` in the desktop build). Distribution today means shipping an executable, dealing with OS webviews, and keeping data on one machine.

That makes the product hard to share and easy to lose. Moving to a hosted app fixes distribution, but it also creates a new problem: student names, availability, and weekly schedules would live on our servers. Those records are sensitive. Row-level access control is not enough. Anyone with database, backup, or support access could still read plaintext.

The product requirement is therefore:

1. Same product as today, in the browser.
2. Each signed-in user has their own students, subject list, scheduler settings, and saved generated schedules.
3. **Student data is unreadable in storage**, including to Easy Cal admins, Vercel/Neon operators with disk access, and anyone who obtains a database dump.

Identity (email, user id) may be visible to Clerk and to us. Student content must not be.

---

## 2. Goals and non-goals

### Goals

- Hosted web app, no desktop install.
- Clerk authentication (email/password at minimum; passkeys strongly preferred).
- Functional parity with the current Students / Subjects / Scheduler tabs.
- Per-user persistence that survives browser close and works on a second device.
- Zero-knowledge **at rest**: ciphertext in the database; decryption keys never stored unwrapped on the server.
- Generation of schedules without persisting or logging plaintext student records.
- Import path for existing desktop JSON student files.

### Non-goals (v1)

- Multi-user sharing, organizations, or “tutor team” access to one student roster.
- Native mobile apps.
- Keeping the PyInstaller / pywebview desktop build in lockstep (desktop may remain as a frozen snapshot).
- A school SIS integration, FERPA certification, or BAA (design for sensitivity; do not claim compliance until separately scoped).
- An admin console that can inspect student records (by design, it cannot).
- Real-time collaboration on a live calendar.

---

## 3. Current product (parity baseline)

The app is a weekly tutoring scheduler. Time is modeled in 30-minute slots. Lunch and prep are fixed constraints the generator cannot override.

### 3.1 Students tab

| Capability | Current behavior |
|---|---|
| Create student | Name + blocked times (day, start, end, optional label) saved as `{Name}.json` |
| Upload JSON | Bulk import of `{ "Student Name": { "blocked_times": [...], "can_overlap": [] } }`; optional overwrite of existing names |
| Edit availability | Add/edit/remove blocked times; optional “daily” weekday copy |
| Overlap groups | Bidirectional `can_overlap` lists so selected students may share a slot |
| Delete | Soft-delete: file removed, snapshot written to `.logs/deletion_log.json` |
| Restore | Recreate the JSON file from the deletion log |
| Permanent delete | Remove the deletion-log entry; unrestorable |
| Reload | Re-read files from disk (desktop file-watching analog) |

Student JSON currently contains: `blocked_times[]` (`day`, `start`, `end`, `label`) and `can_overlap[]` (other student names).

### 3.2 Subjects tab

Master subject list (defaults: Math, Language, Writing, Reading, Science). Add/remove tags. Today this lives in `localStorage` (`masterSubjects`), not the backend.

### 3.3 Scheduler tab

- Working days (any subset of the week), start/end time (default Mon–Fri, 08:00–17:00).
- Lunch start time (default 12:00).
- Optional 1-hour daily prep (flexible placement).
- Per-student subject assignments:
  - **Weekly:** N sessions/week × minutes per session.
  - **Daily:** minutes every working day.
- Color per student for calendar display.
- **Generate Schedule** calls `POST /api/generate` with the full request (students, blocked times, configs, working hours).
- Visual week calendar; inline slot edit with conflict checks.
- Export: JSON, CSV, text, PNG, PDF.
- Save / list / load / delete named generated schedules as JSON files.

### 3.4 What is *not* persisted today

Scheduler configuration (working hours, which students are in the run, subject assignments, colors) is in-memory only. Master subjects are browser-local. That is a desktop limitation, not a product feature. **The web app must persist all of this per user**, or a second device / new browser is an empty product.

### 3.5 Desktop-only behavior to drop

| Desktop behavior | Web replacement |
|---|---|
| Local schedule directory / path display | Hidden; storage is the user’s vault |
| “Reload from disk” | Refresh from the user’s encrypted cloud vault |
| Backend health polling on launch | App is always hosted; show Clerk session + vault unlock |
| PyInstaller single-folder JSON files | Encrypted records in Postgres |
| `127.0.0.1:8000` API | Same-origin Next.js routes |

---

## 4. Users and tenancy

v1 is **B2C personal accounts**.

- One Clerk user = one private vault.
- No organizations, invitations, or shared rosters.
- Signing in on another browser/device unlocks the same vault after authentication **and** vault unlock (see §6).
- Account deletion deletes the vault ciphertext. There is no server-side way to export student plaintext for the user unless they unlock the vault in the client first.

Clerk Organizations stay off unless a later version adds tutor teams. If that happens, sharing must be explicit (re-wrap a DEK for another user). Silent “org admin can see students” would violate this spec.

---

## 5. Threat model

### In scope (must hold)

| Attacker | Must not learn |
|---|---|
| Easy Cal operator with DB GUI / SQL | Student names, blocked times, labels, overlap lists, generated calendars |
| Stolen Neon backup or Vercel Blob dump | Same |
| Support staff | Same (they may see Clerk email, user id, vault byte size, last write time) |
| Application logs / APM | Request bodies and error messages must not contain student plaintext |
| Another Easy Cal user | Anything in this vault (strict `user_id` isolation even of ciphertext) |

### Out of scope (disclose, do not pretend)

- Compromised user device, browser extensions, or shoulder surfing.
- A user who shares their Clerk account **and** vault passphrase / recovery key.
- Clerk itself (identity provider sees emails and auth events; it must never receive student records).
- A future malicious build of the web client that exfiltrates keys (supply-chain). Mitigate with CSP, dependency pinning, and review — not cryptography.
- Legal compulsion against the **user** (they hold the keys). Compulsion against Easy Cal yields ciphertext only.

### What “admins cannot see it in storage” actually requires

Server-side encryption with a key we hold (KMS, `DATABASE_URL` plus `ENCRYPTION_KEY` env var, Postgres TDE) **fails the requirement**. Admins who can read env vars or decrypt volumes can read students.

The only design that matches the wording is **client-side encryption**: the browser encrypts before upload; the database stores opaque bytes; the server never has the unwrapped data-encryption key.

That decision forces a second one: the Python generator currently needs plaintext names and availability. If generation stays on the server, plaintext crosses our functions, logs, and memory on every Generate click. **v1 therefore runs the scheduler in the browser.** The server stores and returns ciphertext only.

---

## 6. Security design (recommended)

### 6.1 Approach comparison

| Approach | Admins can read DB? | Generate without leaking? | UX | Verdict |
|---|---|---|---|---|
| RLS + plaintext Postgres | Yes | No | Easy | Reject |
| Server envelope encryption (app KMS key) | Yes, if they have the key | No, unless generate is local | Easy | Reject for student data |
| Client encrypt, server decrypt for generate | No at rest | Weak (function memory, logs) | Medium | Reject |
| **Client encrypt + client scheduler** | **No** | **Yes** | Medium (vault unlock) | **Choose** |

### 6.2 Vault cryptography

Use Web Crypto only. Do not invent protocols.

1. On first vault creation, the client generates a random **DEK** (AES-256-GCM, 256-bit).
2. The DEK never leaves the device unwrapped.
3. All student-related JSON is encrypted as a single **vault document** (or per-record blobs that still use that DEK — see §8). Algorithm: AES-256-GCM, random 96-bit IV per object, AAD = `userId || objectType || schemaVersion`.
4. The DEK is **wrapped** (AES-KW or AES-GCM) under one or more wrapping keys:
   - **Vault passphrase** (required fallback): Argon2id in WASM (`hash-wasm` or equivalent), parameters tuned for ~500ms on a typical laptop, random salt stored next to the wrapped DEK.
   - **Recovery key**: 24-byte CSPRNG secret, shown once as a printable code; wraps the same DEK. Losing passphrase **and** recovery key is unrecoverable.
   - **Passkey PRF** (strongly recommended when the browser supports WebAuthn PRF): wrap the DEK with the PRF output so daily unlock is biometric/passkey, not a second password.

Clerk authenticates identity. Clerk does **not** wrap the DEK. A Clerk password reset must not destroy or decrypt the vault. Unlock is a second factor that only the user has.

### 6.3 Unlock flow

```
Sign in with Clerk
        │
        ▼
Load vault metadata (wrapped DEKs, salts, crypto version) — no student data
        │
        ▼
   Vault exists?
     no ──► Create passphrase + show recovery key + generate DEK
     yes ─► Unlock with passkey PRF, or passphrase, or recovery key
        │
        ▼
Unwrap DEK into memory (JS CryptoKey, extractable: false after import if possible)
        │
        ▼
GET ciphertext → decrypt in browser → render app
```

Idle timeout: wipe the in-memory DEK after 15 minutes of inactivity (configurable). Relock does not sign the user out of Clerk.

### 6.4 What the server is allowed to store in plaintext

| Field | Plaintext? | Why |
|---|---|---|
| Clerk `user_id` | Yes | Ownership index |
| Crypto version, KDF params, salts, wrapped DEKs | Yes | Needed to unlock; not student content |
| Ciphertext blobs, IVs, GCM tags | Yes (opaque) | The payload |
| `updated_at`, approximate byte length | Yes | Sync / support |
| Student names, times, labels, calendars | **Never** | Requirement |
| Scheduler config that includes student names | **Never** | Same |
| Master subject strings | Encrypt with the vault | Custom subjects can be identifying; cheap to include |
| Clerk email | Clerk’s store, not ours | Do not copy into our DB |

### 6.5 Logging and operations rules

- Vault API routes never log bodies, decrypted anything, or student identifiers.
- Error messages to clients are generic (`decrypt_failed`, `not_found`).
- No admin SQL views, Metabase dashboards, or support tools that decode vaults.
- Backups are ciphertext. Restore is ciphertext.
- Vercel / APM: disable request-body capture on `/api/vault*`.
- CSP: `default-src 'self'`; Clerk script origins allowlisted; no `unsafe-eval` except if a WASM KDF loader requires a documented exception.

### 6.6 Account lifecycle

| Event | Behavior |
|---|---|
| Sign up | Create empty vault after passphrase + recovery key |
| Sign in, new device | Same Clerk user; must unlock vault |
| Forgot Clerk password | Reset via Clerk; vault still locked until passphrase/passkey/recovery |
| Forgot vault passphrase | Recovery key only |
| Lost both | Data is gone; UI must say this **before** vault creation |
| User deletes account | Delete all rows for `user_id`; Clerk user deleted via webhook |
| Permanent student delete | Rewrite vault without that record (already encrypted); no plaintext tombstone |

### 6.7 Honest limitations to show in-product

On vault setup, the user must acknowledge:

- Easy Cal cannot reset student data access.
- Recovery key is the only backup if the passphrase is forgotten (unless a passkey wrapping is registered).
- Exports (JSON/CSV/PDF) are plaintext **on the user’s machine** after unlock — that is intended.

---

## 7. Recommended stack

| Layer | Choice | Rationale |
|---|---|---|
| App | Next.js App Router (TypeScript) on Vercel | Hosted distribution, Clerk first-party, Fluid Compute |
| Auth | Clerk (`@clerk/nextjs` v7 / Core 3) via Vercel Marketplace | Requested; sessions, MFA, passkeys |
| Database | Neon Postgres | Ciphertext + vault metadata; RLS on `user_id` as defense in depth |
| Crypto | Web Crypto AES-GCM + Argon2id (WASM) | Standard, auditable |
| Scheduler | TypeScript port of `backend/scheduler.py`, run in the client | Keeps plaintext off the server |
| UI | Port existing React components and CSS | Parity; avoid a visual rewrite in v1 |
| Python FastAPI | Retired from production | Remain as a **test oracle** until the TS port matches golden outputs |

Do not send student payloads to a Python function in production, even “just for generate.”

---

## 8. Data model

### 8.1 Logical vault document (plaintext, client-only)

This is the in-memory shape after decrypt. It is the web equivalent of today’s files + `localStorage` + unsaved scheduler config.

```ts
type VaultDocument = {
  schemaVersion: 1;
  subjects: string[];            // master list
  students: Record<string, {
    blockedTimes: Array<{
      day: string;               // "Monday" …
      start: string;             // "HH:MM" 24h
      end: string;
      label: string | null;
    }>;
    canOverlap: string[];
  }>;
  deletedStudents: Record<string, {
    deletedAt: string;           // ISO
    blockedTimes: VaultDocument["students"][string]["blockedTimes"];
    canOverlap: string[];
  }>;
  scheduler: {
    workingHours: { days: string[]; startTime: string; endTime: string };
    lunchTime: string;
    prepTimeRequired: boolean;
    students: Array<{
      name: string;
      color: string | null;
      subjects: Array<{
        name: string;
        constraintType: "daily" | "weekly";
        dailyMinutes: number | null;
        weeklyDays: number | null;
        weeklyMinutesPerSession: number | null;
      }>;
    }>;
  };
  savedSchedules: Array<{
    id: string;                  // uuid
    name: string;
    savedAt: string;
    result: ScheduleResponse;    // same shape as today's API response
  }>;
};
```

v1 may persist this as **one encrypted blob per user** (simplest, matches a JSON directory dump). Split into per-student ciphertext later only if blob size or conflict-free sync requires it. Until then, last-write-wins with `updated_at` + a monotonic `revision` is enough for a single tutor.

### 8.2 Postgres (server)

```sql
-- Defense in depth: even ciphertext is not readable cross-user via the API.
CREATE TABLE vaults (
  user_id           TEXT PRIMARY KEY,          -- Clerk user id
  schema_version    INTEGER NOT NULL,
  crypto_version    INTEGER NOT NULL,
  kdf_params        JSONB NOT NULL,            -- argon2id memory/time/salt (b64)
  wrapped_deks      JSONB NOT NULL,            -- [{kind:'passphrase'|'recovery'|'prf', ...}]
  ciphertext        BYTEA NOT NULL,
  nonce             BYTEA NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  revision          BIGINT NOT NULL DEFAULT 1
);

ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
-- Policies: SELECT/INSERT/UPDATE/DELETE WHERE user_id = current_setting('app.clerk_user_id')
-- API sets that setting from the verified Clerk JWT only.
```

No second table of student names. No search index on student content (impossible without breaking zero-knowledge).

### 8.3 Clerk

Store only auth. Do **not** put student JSON, vault passphrases, or DEKs in Clerk `publicMetadata` / `unsafeMetadata` / `privateMetadata`. Optional: a boolean `vaultInitialized` in public metadata for UX routing — no PII.

---

## 9. Authentication (Clerk)

### 9.1 Product behavior

- Unauthenticated `/` is a short marketing/sign-in landing page (the current app must not load student UI).
- Protected app routes: `/app` (or `/` after sign-in).
- Sign up / sign in / user button in the header (replaces nothing in the current header except adding session).
- Session required for vault API. Scheduler itself is local after unlock.

### 9.2 Configuration

- Clerk development + production instances.
- Email + password enabled.
- Passkeys enabled.
- MFA optional but offered.
- Organizations **disabled**.
- Sign-in/up hosted on `/sign-in`, `/sign-up` (Clerk components, shadcn theme if the UI is moved to shadcn; otherwise match current CSS).
- `proxy.ts` / `clerkMiddleware`: public = `/`, `/sign-in(.*)`, `/sign-up(.*)`; everything else authenticated.
- Webhook `user.deleted` → delete `vaults` row.

### 9.3 API auth

Every vault route:

1. `auth()` from `@clerk/nextjs/server`.
2. Reject missing `userId`.
3. Bind queries to that `userId` only.
4. Return the caller’s ciphertext. Never decrypt on the server.

---

## 10. Application architecture

```
┌─────────────────────────────────────────────────────────┐
│ Browser                                                 │
│  Clerk session                                          │
│  Vault unlock (passphrase / PRF / recovery)             │
│  In-memory DEK                                          │
│  Decrypt vault → React state (today’s tabs)             │
│  TypeScript scheduler.generate(request)                 │
│  Encrypt vault → PUT /api/vault                         │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS, ciphertext only
┌───────────────────────────▼─────────────────────────────┐
│ Next.js on Vercel                                       │
│  clerkMiddleware                                        │
│  GET/PUT /api/vault  (opaque bytes)                     │
│  DELETE /api/account                                    │
└───────────────────────────┬─────────────────────────────┘
                            │
                     Neon (ciphertext)
```

### 10.1 Feature mapping (UI)

Keep the three-tab layout and existing components, with these behavioral changes:

| Component | Change |
|---|---|
| `App.jsx` | Clerk-aware shell; gate on vault unlock; persist vault on student/config/schedule mutations (debounced) |
| `CreateStudentSchedule` | Write into vault, not `POST /api/schedules/save` |
| `StudentScheduleUpload` | Parse JSON in the client; merge into vault; keep overwrite prompt |
| `StudentSchedulesView` | Same editor; debounce-save encrypts the whole vault |
| `DeletedStudentsView` | Read `deletedStudents` from vault |
| `SubjectManagement` | Vault `subjects`, not `localStorage` |
| `SchedulerConfiguration` | Load/save `scheduler` from vault |
| `SavedSchedulesManager` | Vault `savedSchedules` |
| `ScheduleDisplay` | Unchanged exports (client-side PNG/PDF already) |
| Generate button | Call local `generateSchedule()`, not FastAPI |

Drop `ScheduleDirectoryConfig` and the “Reload Schedules” disk metaphor. Replace with “Sync status” (saved / saving / conflict).

### 10.2 Scheduler port

- Port `backend/scheduler.py` to TypeScript **with golden tests**: run the current Python `generate_schedule` on a fixture suite (`sample_schedule.json`, overlap cases, daily vs weekly, unsatisfiable constraints) and require byte-for-byte or semantically equal `ScheduleResponse`.
- Slot duration remains 30 minutes.
- Bidirectional `can_overlap` unchanged.
- Conflicts still returned in `conflicts[]`; partial schedules still allowed as today.
- Keep Python module in-repo as oracle until tests are green; then it can move to `/legacy`.

### 10.3 Persistence UX

- Autosave ~500ms after edits (same idea as today’s per-student debounce).
- Optimistic UI; on `revision` conflict, last-write-wins is acceptable for v1 **if** the UI warns when `updated_at` changed from another device. Do not merge student graphs in v1.
- “Saved schedules” names remain unique per user.

### 10.4 Import / export

- **Import students:** existing JSON upload format, plus a “import vault backup” of the encrypted blob is unnecessary in v1.
- **Export students:** download the current plaintext student map as JSON (unlocked session only) so desktop users can round-trip.
- **Export schedule:** keep JSON / CSV / text / PNG / PDF.

### 10.5 Desktop → web migration for existing users

1. On the old app, they already have per-student JSON (or can export).
2. After web sign-up + vault create, **Upload Student Schedules** imports them.
3. They re-enter scheduler config once (or we add a later “import full workspace JSON” if needed).
4. No automated read of `%APPDATA%` from the browser (impossible).

---

## 11. Functional requirements (v1)

Each item is required for parity unless marked *new*.

### Auth & vault

- FR-A1 Sign up, sign in, sign out via Clerk.
- FR-A2 First run: create vault passphrase, display recovery key once, require confirmation that it was stored.
- FR-A3 Subsequent runs: unlock vault before any student UI.
- FR-A4 Lock vault without signing out.
- FR-A5 Register a passkey wrapping when WebAuthn PRF is available. *new*
- FR-A6 Delete account: Clerk user + vault row. *new*

### Students

- FR-S1 Create student with blocked times and labels.
- FR-S2 Upload JSON (create / skip existing / overwrite).
- FR-S3 Edit and delete blocked times; weekday “daily” helper.
- FR-S4 Set bidirectional overlap peers.
- FR-S5 Soft-delete student; restore; permanent delete.
- FR-S6 Empty state: no students, with create + upload CTAs.

### Subjects

- FR-B1 Master list with add/remove; defaults as today.

### Scheduler

- FR-C1 Working days and hours, lunch, prep toggle.
- FR-C2 Assign students (from roster + ad-hoc names as today), colors, daily/weekly subject constraints.
- FR-C3 Generate; show success message, conflicts, week grid.
- FR-C4 Edit a session slot with validation.
- FR-C5 Export JSON, CSV, text, PNG, PDF.
- FR-C6 Save / load / delete named generated schedules (409 on duplicate name).

### Persistence

- FR-P1 All of the above survives refresh and a second browser after unlock. *new vs desktop config*
- FR-P2 No student plaintext in network payloads (verify with a test that intercepts `/api/vault` and asserts non-UTF8 / no known student names). *new*

---

## 12. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | HTTPS only; HSTS on the production domain. |
| NFR-2 | Generate a typical ~10-student week in under 2s on a mid-range laptop (current algorithm is greedy/heuristic, not a cloud solver). |
| NFR-3 | Vault blob target: comfortably under 1 MB for expected use; reject > 4 MB with a clear error. |
| NFR-4 | Accessibility: keep existing structure; Clerk components must be keyboard-usable. |
| NFR-5 | Tests: Clerk testing helpers for gated routes; crypto round-trip tests; scheduler golden tests; no-plaintext contract test. |
| NFR-6 | No PII in client error telemetry. |
| NFR-7 | Browser support: last two Chrome/Edge/Firefox/Safari. Private mode must work (memory-only DEK). |

---

## 13. Legal / privacy notes (not legal advice)

Student names plus weekly whereabouts are sensitive, and in a school context may be education records. v1 is aimed at an individual tutor using a personal account.

Ship with:

- Privacy policy stating **zero-knowledge storage**: we cannot read student schedules.
- Terms stating **no recovery** if passphrase and recovery key are lost.
- Export/delete (account deletion) for the user’s own data.
- No sale of student data; no training models on vault contents (we cannot read them).

If a school or district becomes the customer, FERPA/BAA and org tenancy are a **new spec**, because zero-knowledge and “school admin must audit” are in tension.

---

## 14. Delivery plan

### Phase 0 — Decisions (this spec)

Confirm: personal Clerk accounts, client-side vault, TS scheduler, no org sharing.

### Phase 1 — Skeleton

Next.js app on Vercel, Clerk sign-in, landing vs `/app` shell, empty vault create/unlock UI. No students yet.

### Phase 2 — Crypto + store

Web Crypto helper, Argon2id wrap, Neon `vaults` table, GET/PUT ciphertext, revision, account delete webhook. Contract test: student names never appear on the wire.

### Phase 3 — Port UI + persist

Move the three tabs onto the decrypted vault. Replace every `fetch('/api/schedules…')` and `localStorage` subject list. Keep CSS.

### Phase 4 — Scheduler parity

TypeScript port + golden tests vs Python. Wire Generate. Exports unchanged.

### Phase 5 — Hardening

Passkey PRF wrap, idle lock, CSP, log redaction, recovery-key UX review, import from desktop JSON, production Clerk instance.

Desktop app is not updated except a README note pointing at the web app.

---

## 15. Success criteria

The migration is done when:

1. A new user can sign up, create a vault, add students, generate, save, export — without installing anything.
2. A second browser, after Clerk sign-in and vault unlock, shows the same students and saved schedules.
3. A database dump of `vaults` contains no student names from a known fixture.
4. Server logs from a generate-and-save session contain no student names.
5. Scheduler golden tests match the Python oracle on the fixture suite.
6. Soft-delete / restore / permanent delete still work.
7. Losing the Clerk password does not destroy the vault; losing passphrase **and** recovery key does.

---

## 16. Open items (defaults if you do not override)

| Topic | Default in this spec | Alternative |
|---|---|---|
| Tenancy | Personal accounts only | Clerk orgs later, with explicit DEK re-wrap |
| Scheduler location | Browser TypeScript | Rejected: Python on Vercel |
| Unlock UX | Passphrase + recovery key; PRF when available | Passphrase-only (weaker UX) |
| Vault granularity | One blob per user | Per-student rows if sync conflicts appear |
| Conflict handling | Last-write-wins + warning | CRDT / manual merge (v2) |
| Subject of encryption | Entire vault including subjects and working hours | Encrypt only `students` (weaker, not worth it) |
| Desktop app | Freeze; README points to web | Maintain both (out of scope) |

---

## 17. Appendix — current API to retire

| Endpoint | v1 fate |
|---|---|
| `GET /api/health` | Platform health only, unauthenticated |
| `POST /api/upload` | Client-side parse + vault write |
| `POST /api/generate` | Client `generateSchedule()` |
| `GET/POST /api/schedules/*` | Vault document |
| `GET/POST/DELETE /api/saved-schedules/*` | Vault `savedSchedules` |
| `GET /api/schedules/directory` | Deleted |

Replacement surface:

| Endpoint | Body |
|---|---|
| `GET /api/vault` | `{ revision, schemaVersion, cryptoVersion, kdfParams, wrappedDeks, ciphertext, nonce, updatedAt }` |
| `PUT /api/vault` | Same, with `if-match` revision |
| `DELETE /api/account` | Confirmed session; deletes vault then Clerk user |

No other student APIs.
