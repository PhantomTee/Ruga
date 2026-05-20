# Ruga

Bet on rugs before they happen.

Ruga is a Next.js prediction market app backed by a Solidity contract on Arc testnet. The agent scans `iterativv/NostalgiaForInfinity` commits for blacklist additions, validates signals with Groq, opens USDC markets on-chain, stores state in Supabase, and resolves outcomes from CoinGecko prices after seven days.

## Required Environment

Create `.env.local` with:

```bash
GITHUB_TOKEN=
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AGENT_PRIVATE_KEY=
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_ARC_CHAIN_ID=
NEXT_PUBLIC_ARC_RPC=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
CRON_SECRET=
```

All values are read from `process.env`. The app intentionally fails with explicit errors when required live credentials are missing.

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. It creates:

- `markets`
- `bets`
- `commits_processed`

RLS is enabled on every table. Public clients can read rows; writes require the Supabase service role key used by the server routes.
The `commits_processed` table uses a `processing` status as a database-backed lock so overlapping cron executions do not process the same commit twice.

## Contract

Compile:

```bash
$env:LOCALAPPDATA=(Join-Path (Resolve-Path .).Path '.hardhat-local')
pnpm exec hardhat compile
```

Deploy to Arc testnet after setting `AGENT_PRIVATE_KEY`, `NEXT_PUBLIC_ARC_RPC`, `NEXT_PUBLIC_ARC_CHAIN_ID`, and `NEXT_PUBLIC_USDC_ADDRESS`:

```bash
pnpm deploy:arc
```

Copy the deployed address into `NEXT_PUBLIC_CONTRACT_ADDRESS`.
The contract accrues the 2% platform fee separately as `accruedPlatformFees`; the owner can withdraw those fees with `withdrawPlatformFees`.

## Agent Routes

Vercel Cron invokes:

- `/api/agent/scan` every five minutes
- `/api/agent/resolve` daily at 12:00 UTC

Both routes support `GET` for Vercel Cron and `POST` for direct operational calls.
When `CRON_SECRET` is set, both agent routes require `Authorization: Bearer $CRON_SECRET`.

## Local Verification

```bash
pnpm install
pnpm test
pnpm build
$env:LOCALAPPDATA=(Join-Path (Resolve-Path .).Path '.hardhat-local')
pnpm exec hardhat compile
pnpm exec next dev -p 3027 --hostname 127.0.0.1
```

Without live env vars, pages render but API routes that need Supabase, Arc, Groq, GitHub, or CoinGecko return explicit configuration errors rather than invented data.
