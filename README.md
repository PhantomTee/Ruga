# RUGA

**Bet on the rug. AI-powered prediction markets for crypto rugpulls.**

An autonomous agent scans the blockchain ecosystem every 5 minutes across 5 detection sources. When it finds a suspicious token, Groq AI scores the signal. If confidence clears 70%, a 7-day on-chain prediction market opens automatically. You bet YES (token rugs) or NO (it survives). Winners split the loser pool.

Live on [Arc Testnet](https://testnet.arcscan.app).

---

## How It Works

**01 / Scan**

A GitHub Actions workflow fires every 5 minutes, hitting 5 independent detection sources in parallel: GitHub blacklist commits (NostalgiaForInfinity), RugCheck, DexScreener price crash patterns, GoPlusSecurity flags, and on-chain token profile feeds. Any flagged token is queued for AI validation.

**02 / Validate**

Groq runs Llama 3.3 70B Versatile against the raw signal. It returns a confidence score (0 to 100) and a written reasoning. Signals below 70 are discarded. When two or more independent sources flag the same token, multi-source confirmation applies and the effective threshold lowers.

**03 / Market Opens**

A prediction market is created on-chain via the `RugaMarket` smart contract on Arc Testnet. The opening token price is recorded. The market resolves after 7 days. Resolution criteria: did the token lose 80% or more of its value?

**04 / Bet**

Users connect a wallet, approve USDC, and take a side. YES means the token rugs. NO means it survives. The pools grow as bets come in. Odds and pool sizes update in real time.

**05 / Resolve and Claim**

A daily GitHub Actions job resolves all expired markets on-chain. Winners call `claimWinnings()` directly on the contract. Payouts are proportional to stake within the winning pool, after a 2% protocol fee.

---

## Features

- Autonomous AI agent that scans, validates, creates markets, and places its own bets
- 5 detection sources running in parallel every 5 minutes
- Groq AI reasoning stored on every market with a human-readable explanation of the signal
- Live DexScreener charts embedded per market so users can assess the token before betting
- Real-time activity feed updating every 5 seconds via polling and BroadcastChannel
- Portfolio tracker with win rate, P&L, and per-bet payout estimates
- Leaderboard ranked by all-time betting volume
- On-chain resolution proof with verifiable contract links on every resolved market
- Mobile-first UI with a custom display font, strict black/red palette, and responsive layouts throughout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Wallet | wagmi v2 + ConnectKit |
| Chain interaction | ethers.js v6 + viem |
| Database | Supabase (PostgreSQL) |
| AI | Groq SDK (Llama 3.3 70B Versatile) |
| Smart contract | Solidity + Hardhat |
| Scheduling | GitHub Actions (cron) |
| Price data | CoinGecko + DexScreener |

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page with live protocol stats and mascot |
| `/markets` | All open and resolved prediction markets |
| `/market/[id]` | Market detail: rug score, chart, live DexScreener feed, bet history |
| `/portfolio` | Connected wallet bets, P&L, and win rate |
| `/activity` | Global live bet feed |
| `/leaderboard` | Top bettors ranked by total volume |
| `/rugaai` | Agent wallet, scan metrics, and status |
| `/status` | On-chain resolution proof for all resolved markets |

---

## API Routes

| Endpoint | Purpose |
|---|---|
| `GET /api/markets` | All markets, with optional `wallet` filter |
| `GET /api/markets/[id]` | Single market with bets, price chart, and on-chain data |
| `POST /api/bets` | Record a bet after on-chain transaction confirms |
| `GET /api/activity` | Latest 50 bets across all markets |
| `GET /api/portfolio` | All bets for a given wallet address |
| `GET /api/leaderboard` | Top bettors by volume |
| `GET /api/stats` | Protocol totals: markets, bets, USDC wagered, unique bettors |
| `POST /api/agent/scan` | Full detection scan and auto-bet (cron-protected) |
| `POST /api/agent/resolve` | Resolve all expired markets on-chain (cron-protected) |
| `GET /api/agent/status` | Last scan time, next scan time, scan count today |

---

## Agent Architecture

The agent runs entirely server-side with no persistent process. Each GitHub Actions trigger is stateless.

```
GitHub Actions (every 5 minutes)
    |
    POST /api/agent/scan
        |
        +-- fetchGithubSignals()         NostalgiaForInfinity blacklist commits
        +-- fetchRugCheckSignals()        RugCheck risk score API
        +-- fetchDexScreenerSignals()     Price crash pattern detection
        +-- fetchGoPlusSignals()          GoPlusSecurity on-chain flags
        |
        +-- validateMultiSourceSignal()   Groq (Llama 3.3 70B Versatile)
        |       confidence >= 70 -------> createMarket() on-chain
        |
        +-- placeAgentBets()             Auto-bet up to 3 markets per scan

GitHub Actions (daily at 12:00 UTC)
    |
    POST /api/agent/resolve
        +-- fetch final token prices (CoinGecko / DexScreener fallback)
        +-- resolveMarket() on-chain for each expired market
        +-- record outcomes in Supabase
```

---

## Smart Contract

`RugaMarket.sol` is deployed on Arc Testnet via Hardhat.

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network arcTestnet
```

Copy the deployed address into `NEXT_PUBLIC_CONTRACT_ADDRESS`.

Key functions:

| Function | Description |
|---|---|
| `createMarket(symbol, priceAtCreation, resolvesAt)` | Opens a new prediction market |
| `placeBet(marketId, side)` | Places a YES or NO bet with USDC |
| `resolveMarket(marketId, outcome, finalPrice)` | Owner-only resolution |
| `claimWinnings(marketId)` | Winner claims proportional payout minus 2% fee |
| `withdrawPlatformFees()` | Owner withdraws accrued protocol fees |

---

## Environment Variables

```env
# Arc Testnet
NEXT_PUBLIC_ARC_CHAIN_ID=            # Numeric chain ID for Arc Testnet
NEXT_PUBLIC_ARC_RPC=                 # Arc Testnet RPC URL
NEXT_PUBLIC_CONTRACT_ADDRESS=        # Deployed RugaMarket contract address
NEXT_PUBLIC_USDC_ADDRESS=            # USDC token address on Arc Testnet

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GROQ_API_KEY=                        # Groq API key for Llama 3.3 70B

# Agent
AGENT_PRIVATE_KEY=                   # Private key for the agent betting wallet
CRON_SECRET=                         # Shared secret protecting cron endpoints

# Optional
GITHUB_TOKEN=                        # Increases GitHub API rate limit for scans
COINGECKO_API_KEY=                   # CoinGecko Pro key for price chart data
```

Without live credentials, pages render but API routes that need Supabase, Arc, Groq, GitHub, or CoinGecko return explicit configuration errors rather than invented data.

---

## GitHub Actions Setup

Two workflows live in `.github/workflows/`.

`agent-scan.yml` triggers every 5 minutes and calls `POST /api/agent/scan`.  
`agent-resolve.yml` triggers daily at 12:00 UTC and calls `POST /api/agent/resolve`.

Both require two GitHub repository secrets:

| Secret | Value |
|---|---|
| `RUGA_APP_URL` | Your deployment URL, e.g. `https://your-app.vercel.app` |
| `CRON_SECRET` | Must match the `CRON_SECRET` environment variable on the server |

---

## Database

Run `supabase/schema.sql` in the Supabase SQL editor. It creates three tables: `markets`, `bets`, and `commits_processed`.

RLS is enabled on every table. Public clients can read rows. Writes require the service role key used by server routes. The `commits_processed` table uses a `processing` status as a database-backed lock so overlapping cron executions never process the same commit twice.

**`markets` (key columns)**

| Column | Type | Notes |
|---|---|---|
| `id` | int8 | Supabase primary key (used for all app routing) |
| `on_chain_id` | int8 | Contract-native market index |
| `token_symbol` | text | |
| `groq_confidence` | int4 | 0 to 100 |
| `groq_reasoning` | text | Llama-generated signal explanation |
| `price_at_creation` | numeric | Scaled by 1e8 |
| `yes_pool` | numeric | USDC, mirrored from chain |
| `no_pool` | numeric | USDC, mirrored from chain |
| `resolves_at` | timestamptz | 7 days after creation |
| `resolved` | bool | |
| `outcome` | bool | `true` = rugged, `false` = survived |
| `final_price` | numeric | Scaled by 1e8 |

**`bets` (key columns)**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `market_id` | int8 | References `markets.id` |
| `wallet_address` | text | |
| `side` | text | `yes` or `no` |
| `amount` | numeric | USDC |
| `tx_hash` | text | On-chain transaction hash |

---

## Local Development

```bash
git clone https://github.com/phantomtee/ruga
cd ruga
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

App runs at `http://localhost:3000`.

```bash
npm test    # core logic tests
npm run build   # production build
```

---

## Resolution Logic

Markets resolve once `resolves_at` has passed. The agent fetches the current token price via CoinGecko, falling back to DexScreener if no CoinGecko data exists. It compares the final price against `price_at_creation` and calls `resolveMarket()` on the contract with `outcome = true` if the price has dropped 80% or more.

---

## License

MIT
