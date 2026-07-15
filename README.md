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
- **Ledger:** A server-side prepaid balance (`lib/ledger.ts`). Ships with an
  in-memory implementation for local dev — **swap this for a real database
  before going to production**, since serverless instances don't share memory.
- **OnchainOS Wallet API:** HMAC-signed requests (`lib/onchainos-client.ts`)
  following OKX's standard signing scheme. `getWalletBalance` tries both the
  `/wallet/balance` and `/wallet/balances` path shapes, since OnchainOS has
  used both.
- **Content moderation:** Whizpr is for genuine hazard/emergency footage
  only. Uploads are restricted to image/video MIME types and videos over 30
  seconds are rejected client-side. Every submitted report is queued for
  human review (`lib/reports-store.ts`'s `moderationStatus`); admins — wallet
  addresses listed in `ADMIN_ADDRESSES` — review via `/api/moderation/reports`
  and `/api/moderation/reports/[id]/action`, and can penalize a violator by
  force-deducting Whizcredits (`lib/ledger.ts`'s `penalizeCredits`) or
  banning their address (`lib/moderation-store.ts`), which blocks further
  report submissions. There's no admin UI yet — the moderation endpoints are
  API-only for now.
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
   - `LEDGER_DATABASE_URL` (once you've wired up real storage)
   - `BLOB_READ_WRITE_TOKEN` (if using Vercel Blob for media uploads)
   - `ADMIN_ADDRESSES` (wallets allowed to review reports and apply
     moderation penalties)

   Vercel encrypts these at rest; none of them should be committed to git.

4. **Redeploy** after setting env vars — Vercel doesn't hot-reload existing
   deployments when you add variables. Either push a new commit or trigger
   "Redeploy" from the deployment's `...` menu in the dashboard.

5. **Verify OnchainOS connectivity** once deployed by hitting
   `/api/onchainos/balance` while signed in — this exercises the HMAC
   signing and both balance endpoint path variants.

## Known gaps / next steps

- Ledger, reports, profiles, bans, and moderation state are all in-memory
  only — need a real database before production traffic.
- No responder-side "nearby alerts" view yet — this scaffold covers the
  reporter-side auth → deposit → alert flow only.
- WalletConnect is optional; set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to
  enable it alongside the injected-wallet connector.
- No admin UI for the moderation queue yet — `/api/moderation/reports` and
  `/api/moderation/reports/[id]/action` are API-only. Private Blob media
  (uploaded with `access: 'private'`) also has no authenticated viewer route
  yet, so reviewing the actual footage currently requires fetching it
  server-side with the Blob token.
- The 30-second video cap is enforced client-side (and the server checks the
  client-reported duration when present); there's no server-side media
  parsing, so a deliberately crafted request could bypass it — moderation
  review is the backstop.
