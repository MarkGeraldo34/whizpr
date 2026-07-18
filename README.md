# Whizpr

Real-time public safety web app: users upload emergency media to alert nearby
responders. Built on OKX's OnchainOS infrastructure with a prepaid USDT token
economy.

## Architecture

- **Auth:** SIWE-lite wallet sign-in — standard EIP-4361 message + signature
  verification (via the `siwe` package), backed by a minimal HMAC-signed
  session cookie instead of a full session-store library.
- **Deposits:** Users send USDT to a treasury address; `viem` verifies the
  ERC-20 `Transfer` event and required confirmations server-side before
  crediting the ledger (`lib/viem-server.ts`).
- **Ledger:** A server-side prepaid balance (`lib/ledger.ts`), backed by
  Postgres (`lib/db.ts`) — same for reports, profiles, bans, and responders
  (every `lib/*-store.ts` module). Tables are created automatically on first
  use; point `DATABASE_URL` at a Neon database (Vercel Storage tab → Create
  Database → Neon) and there's nothing else to run.
- **OnchainOS Wallet API:** HMAC-signed requests (`lib/onchainos-client.ts`)
  following OKX's standard signing scheme. `getWalletBalance` tries both the
  `/wallet/balance` and `/wallet/balances` path shapes, since OnchainOS has
  used both.
- **x402 one-shot payments (`lib/x402.ts`):** `POST /api/report` also accepts
  a single OKX Agent Payments Protocol (x402 v2, `exact` scheme) payment as
  an alternative to session + prepaid ledger — no SIWE login or deposit
  needed. A request with no session and no `PAYMENT-SIGNATURE` header gets a
  proper `PAYMENT-REQUIRED` challenge (402) quoting the alert's USDT price
  (converted from `ALERT_COST_WHIZCREDITS` via `whizcreditsToUsdtAtomic`); a
  valid signed authorization is settled through OKX's x402 facilitator, then
  converted into the same Whizcredits credit a deposit would produce and
  immediately spent — so ban checks, refund-on-failure, and the response
  shape are shared with the session path unchanged. EIP-3009 nonces are
  tracked (`processed_x402_payments`) to reject replay. The facilitator
  settle endpoint path is per OKX's docs
  (web3.okx.com/onchainos/dev-docs/payments/api-http-batch) — confirm the
  exact request/response schema there before relying on this in production;
  it wasn't reachable to verify while building this.
- **Live feed:** Reports are auto-published — no admin approval gate before
  they're visible. `GET /api/feed` (public, no auth) returns recent reports,
  including the reported photo/video, with reporter identity always stripped
  out (`lib/reports-store.ts`'s `getPublicFeed`), rendered by
  `components/LiveFeed.tsx`. The country leaderboard counts everything on
  the feed the same way. Media is uploaded to Vercel Blob with
  `access: 'public'` (`lib/media-storage.ts`) so the URLs are directly
  browser-loadable — the storage path itself is a random UUID, not the
  reporter's wallet address, so the media URL can't be used to de-anonymize
  them either. This is a deliberate product choice to make reports publicly
  visible with evidence attached; be aware media can depict real people
  (bystanders, victims) in public emergency situations before choosing this
  tradeoff for your own deployment.
- **Content moderation:** Whizpr is for genuine hazard/emergency footage
  only. Uploads are restricted to image/video MIME types and videos over 30
  seconds are rejected client-side. Admins — wallet addresses listed in
  `ADMIN_ADDRESSES` — review submissions after the fact via
  `/api/moderation/reports` and `/api/moderation/reports/[id]/action`. An
  admin can `delete` an irrelevant/inappropriate report, which removes it
  from the public feed and leaderboard (the underlying record is kept for
  audit, not hard-deleted), and independently apply a penalty — force-
  deducting Whizcredits (`lib/ledger.ts`'s `penalizeCredits`) or banning the
  reporter's address (`lib/moderation-store.ts`), which blocks further
  submissions with a clear error. There's no admin UI yet — the moderation
  endpoints are API-only for now.
- **AI triage:** `lib/triage.ts` sends each submitted **photo** (video isn't
  supported yet — see below) plus the reporter's description to Claude
  (`claude-opus-4-8`, structured JSON output) and asks it to judge whether
  the image is genuine hazard footage and, if so, how severe it looks. This
  runs automatically in `/api/report` before the report is recorded. It's
  deliberately bounded: the model never deletes a report, bans a reporter, or
  removes anything from the public feed — that stays human-only via the
  endpoints above. The only things the triage result does are (1) get stored
  on the report as `aiTriage` so it's visible to admins reviewing the queue,
  and (2) suppress the responder-notification email when the model is
  confident the submission isn't a real hazard, since paging real first
  responders about a meme or a selfie has a real-world cost that a
  sitting-in-the-queue report doesn't. Best-effort like the email
  notification: a missing `ANTHROPIC_API_KEY`, a video submission, or a
  provider error all just skip triage (`aiTriage: null`, treated as
  "unknown" — responders are still notified, same as before this existed)
  rather than blocking the report.
- **Responder notification email:** When a report is submitted, its
  reverse-geocoded country (already computed for the leaderboard) is used to
  look up first-responder contacts registered for that country
  (`lib/responders-store.ts`) and email each of them via Resend
  (`lib/email.ts`). Responders are registered by admins through
  `/api/admin/responders` (`GET` to list, `POST { email, countryCode,
  countryName }` to add, `DELETE /api/admin/responders/[id]` to remove) —
  same `ADMIN_ADDRESSES` gate as moderation. The email send is best-effort:
  a missing `RESEND_API_KEY`, no responders on file for that country, or a
  provider outage all just skip/log rather than blocking the report, since
  the reporter has already been debited and the media already stored.
- **Stack:** Next.js 14 App Router, TypeScript, Wagmi v2, viem, deployed to
  Vercel.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

## Deploying to Vercel

1. **Push to GitHub** (or push directly with the Vercel CLI):
   ```bash
   git init
   git add .
   git commit -m "Initial Whizpr scaffold"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Import the project in Vercel** (vercel.com → Add New → Project → import
   the GitHub repo), or via CLI:
   ```bash
   npm i -g vercel
   vercel link
   vercel
   ```

3. **Set environment variables** in Vercel Project Settings → Environment
   Variables. Add every key from `.env.example` for both **Preview** and
   **Production** environments:
   - `NEXT_PUBLIC_CHAIN_RPC_URL`, `SERVER_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID`
   - `NEXT_PUBLIC_USDT_TOKEN_ADDRESS`, `NEXT_PUBLIC_DEPOSIT_ADDRESS`,
     `DEPOSIT_MIN_CONFIRMATIONS`
   - `SESSION_SECRET` (generate with `openssl rand -hex 32` — use a
     **different** value per environment)
   - `NEXT_PUBLIC_SIWE_DOMAIN` (set to your actual deployed domain, e.g.
     `whizpr.vercel.app`, or your custom domain once attached)
   - `OKX_ONCHAINOS_API_BASE_URL`, `OKX_ONCHAINOS_API_KEY`,
     `OKX_ONCHAINOS_API_SECRET`, `OKX_ONCHAINOS_API_PASSPHRASE`
   - `DATABASE_URL` (Postgres — see "Ledger" above)
   - `BLOB_READ_WRITE_TOKEN` (if using Vercel Blob for media uploads)
   - `ADMIN_ADDRESSES` (wallets allowed to review reports and apply
     moderation penalties)
   - `ANTHROPIC_API_KEY` (AI triage — see "AI triage" above)
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (responder notification emails —
     see "Responder notification email" above)

   Vercel encrypts these at rest; none of them should be committed to git.

4. **Redeploy** after setting env vars — Vercel doesn't hot-reload existing
   deployments when you add variables. Either push a new commit or trigger
   "Redeploy" from the deployment's `...` menu in the dashboard.

5. **Verify OnchainOS connectivity** once deployed by hitting
   `/api/onchainos/balance` while signed in — this exercises the HMAC
   signing and both balance endpoint path variants.

## Known gaps / next steps

- Responders only get an email notification for now (see "Responder
  notification email" above) — there's no responder-side dashboard/"nearby
  alerts" view yet, and no self-serve way for a responder org to register
  itself (registration is admin-only via `/api/admin/responders`).
- WalletConnect is optional; set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to
  enable it alongside the injected-wallet connector.
- No admin UI for the moderation queue yet — `/api/moderation/reports` and
  `/api/moderation/reports/[id]/action` are API-only, though the media itself
  is easy to review since it's a plain public URL (see "Live feed" above).
- The 30-second video cap is enforced client-side (and the server checks the
  client-reported duration when present); there's no server-side media
  parsing, so a deliberately crafted request could bypass it — moderation
  review is the backstop.
