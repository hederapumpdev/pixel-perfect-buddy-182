# HederaPump

A Pump.fun-style meme coin launchpad on **Hedera Mainnet**.
Live at **[hederapump.dev](https://hederapump.dev)**.

Anyone can launch a real HTS token in seconds with just a name, ticker and image,
trade it instantly on an on-chain bonding curve, and watch it graduate automatically
to SaucerSwap with locked liquidity. No coding, no liquidity setup, no permission needed.

## What it does

- **Launch in seconds** — name, ticker, description, social links and an image become a
  real HTS token (8 decimals) on Hedera mainnet, visible in HashPack and on HashScan
  from the moment it is created.
- **On-chain trading** — every buy and sell runs inside the launchpad smart contract
  against a bonding curve. 1% fee, no token approvals, no DEX setup.
- **Creator rewards** — 30% of every trading fee belongs to the coin's creator and is
  claimable from their profile at any time. 70% goes to the platform.
- **Referrals** — 10% of the platform fee (7% of the total fee) flows into one shared
  pool, split pro-rata by the trading volume each referrer's recruits generated.
  Referrers claim it themselves; the contract owner never signs a payout.
- **Hold Out rewards** — every coin builds its own weekly HBAR pot from a slice of its
  trading fees. Holders who keep tokens at least 7 days share it pro-rata, weighted by how
  long they hold (up to 2× after 60 days). Paid straight to the wallet — no staking, no
  locking, no claiming.
- **Automatic graduation** — when 800M tokens are sold, the contract opens a SaucerSwap
  pool with all raised HBAR and locks the liquidity provider tokens forever. No rug pulls.
- **Automatic token info** — v4 coins publish HIP-405 metadata (logo, description,
  website, X and Telegram links) so SaucerSwap shows full token info without a form.
- **Any wallet** — HashPack (via WalletConnect), MetaMask, or an email / Google wallet.
- **Community features** — live ticker, Hedera Hot Seat, holders, comments, price
  alerts, plus automatic top-10 and graduation posts to Telegram and X.

## Deployed contracts (Hedera mainnet)

| Version | Contract ID  | What it adds                                                        |
| ------- | ------------ | ------------------------------------------------------------------- |
| v1      | 0.0.10923845 | 18-decimal ERC-20 style tokens held inside the contract              |
| v2      | 0.0.10924256 | Native HTS tokens (8 decimals), automatic SaucerSwap listing         |
| v3      | 0.0.10924285 | Platform fee paid straight to the fee wallet, creator fee claims     |
| v4      | 0.0.10924813 | HIP-405 token metadata + shared referral pool                        |
| v4-fixed| 0.0.10925851 | v4 with corrected HTS precompile calls                               |
| v4-legacy | 0.0.10925881 | v4 features + legacy HTS token creation — **current launchpad**     |

Platform fees land in the bot wallet `0.0.10927104`, which forwards them automatically;
the platform wallet is `0.0.10923241`.
Coins always stay on the contract that created them, so older coins keep working.

## How the data flows

The chain is the source of truth. A sync job reads Hedera mirror-node events for every
launchpad contract and fills the coin, trade and holder tables. Nothing in those tables
is ever written from user input, so prices, holders and fees shown in the UI come from
the chain.

## Repository layout

```text
contracts/        Solidity launchpad contracts (v1-v4) + compile scripts
src/lib/          bonding-curve math, mirror-node queries, network config,
                  referral capture, USD conversion, social-link handling
src/routes/       pages (explore, create, token page, profile, admin, support)
                  and src/routes/api/public/ read-only adapters (DexScreener,
                  token metadata, scheduled jobs)
src/components/   UI components
src/test/         unit tests for the economics and data helpers
supabase/         database schema and migrations
```

## Running it locally

```sh
npm install
npm run dev      # start the app
npm test         # run the test suite
npm run lint     # check code style
```

The app needs a backend for its synced tables. Environment variables are provided by
the hosting platform; see `src/lib/hedera-config.ts` for the network, contract IDs and
wallet settings.

## Economics

- Trade fee: **1%** of every buy and sell.
- Split: **30% creator**; the 70% platform share is forwarded automatically from the bot
  wallet into **2/7 team**, **1/7 Hold Out** and **4/7 platform**.
- Hold Out: that 1/7 builds **weekly per-coin holder pots**, shared by holders of at least
  7 days, weighted by holding time (up to 2× after 60 days).
- Referral pool: **10% of the platform share**, one shared pot, pro-rata by attributed volume.
- Supply: **1B tokens** per coin, **800M** on the bonding curve.
- Graduation at **800M sold** → SaucerSwap pool, LP locked forever.

## Links

- Website: https://hederapump.dev
- X: https://x.com/hederapumpdev
- Telegram: https://t.me/hederapump
- Exchange: https://saucerswap.finance
- Explorer: https://hashscan.io/mainnet

## Disclaimer

Meme coins are highly speculative and most lose all value. Nothing on this site or in
this repository is financial advice. Trading is done entirely at your own risk.
