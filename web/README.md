# Easy Cal web app

Hosted Student Schedule Generator. Vault encryption happens in the browser; Neon stores ciphertext only.

## Run

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account, then create a vault passphrase. Store the recovery key offline — we cannot reset it.

Privacy and terms: [/privacy](http://localhost:3000/privacy), [/terms](http://localhost:3000/terms). Signed-in account deletion is on [/account](http://localhost:3000/account). `GET /api/health` is unauthenticated.

A vault already on this browser is uploaded to Neon on the next unlock load.

```bash
npm test
npm run db:push
```

Clerk account deletion in the dashboard needs a webhook signing secret (`CLERK_WEBHOOK_SIGNING_SECRET`) pointing at `/api/webhooks/clerk`. Signed-in `DELETE /api/account` deletes the ciphertext immediately.
