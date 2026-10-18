<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Subdirectories have their own `AGENTS.md` (e.g. `contracts/`); read it before changing files there.
- Home-screen support is manifest-only with brand icons; offline workers require explicit user request to avoid stale previews.
- Network, contract IDs and WalletConnect ID live in `src/lib/hedera-config.ts` for centralized configuration.
- Failed v4 deployments stay indexed/tradable. Legacy replacement has a separate ID/artifact; creation requires verified mainnet creation to avoid paid retries. Admin targets the pending legacy artifact.
- Coin/trade tables are filled only by `syncChain` from Hedera mirror-node events — the chain is the source of truth, never write them from user input.
- Browser Node polyfills in Vite must resolve directly to absolute npm package files, only in the client environment; re-resolving bare built-ins can recurse through aliases and exhaust the build.
- Wallet SDKs are stubbed server-side in `vite.config.ts`; dynamically import in browsers only to avoid Worker crashes.
- Wallet connection setup and picker opening have separate deadlines and modal-dismissal cleanup; verify the SDK client exists after init because it swallows failures. Never apply connection retries to transactions.
- Statistics/PnL paginate trades; USD uses current HBAR rate. PnL = net sells + curve value - fee-inclusive buys; label estimates, omit unpriced positions and transfers/network fees. Buyers/sellers distinct per side.
- HashPack deploy uses file-create/append and contract-create with mirror account key; ContractCreateFlow calls an unsupported signer method.
- Deploy sends one wallet request per user tap, tags each tx memo `hpump:<fp>:<offset>:<len>`, and rebuilds progress from mirror-node history — mobile wallets miss requests sent while the browser is backgrounded, and nothing may be paid twice.
- DexScreener adapter lives in `src/routes/api/public/dexscreener/*` (read-only, from synced tables); block numbers are Unix seconds because Hedera has no EVM blocks — DexScreener needs monotonic integers.
- Pin `protobufjs` >=8.6.6 at the root: `@hiero-ledger/proto` (via hedera-wallet-connect) needs `Reader.tag()`; older 8.0.0 breaks wallet transactions with "e.tag is not a function".
- Wallet transactions are frozen for the multi-node list `WALLET_NODE_IDS` in `hedera-config.ts`, never a single node — HashPack rejects unknown nodes and fails outright when its only node is busy.
- Coins carry a `contract` column; every trade/quote/claim path must branch on it via `isV2`/`tokenUnit` in `src/lib/curve.ts` (v1: 18-dec ERC20 in-contract, v2: 8-dec HTS with associate/allowance steps) — never assume one contract or one decimal count.
- Auto-buy bot (`src/lib/bot.server.ts`, key derived from BOT_SEED) runs one transaction step per scheduled call to `/api/public/jobs/autobuy`, tracked in `bot_buys` (token unique) — scheduled requests are short and a coin must never be bought twice.
- Daily X posting uses a managed authenticated schedule, server-only OAuth1 credentials, a database lease and unique slots; uncertain sends pause instead of retrying because X has no posting idempotency key. Images are bundled branded assets and no background AI calls are needed.
- Telegram uses a persisted pinned message ID and lease for scheduled photo-caption edits; images are bundled inline and uploaded through the gateway to avoid unpublished asset URLs, and chain-derived graduation alerts retain unique claims to prevent duplicates.
- Telegram app messages reserve unique slots before sending and reuse a browser-safe topic module; an authenticated hourly callback checks Amsterdam posting windows without depending on X credentials.
- Profiles use useProfiles for alias identity; HederaAddress resolves display IDs only, preserving chain/database addresses.
- The sitemap uses required route-level staticData.sitemap decisions and paginated public-key token reads; exclude private surfaces and omit non-authoritative lastmod dates so search discovery stays safe and complete.
- Referral links: ?ref=<wallet> captured once into localStorage (src/lib/referral.ts, first referrer wins) and sent with every v4 trade; profile shows the Referrals block only when PUMP_CONTRACT_V4_ID is set.
- Legacy SaucerSwap assistance exports synced pre-v4 HTS information client-side with Davinci Pics guidance; never imply submission success or attempt metadata updates because those tokens lack update keys.
- BondingProgress uses synced reserves for a display-only HBAR/USD graduation estimate, including the existing fee; never use it to execute trades.
- Discord coin announcements use a managed authenticated schedule and one atomic token/channel claim per call; read the exact HTS memo from Hedera, disable mentions, persist confirmations, and never retry uncertain sends to avoid duplicate announcements.
- Bot payouts (contest/refunds in `promotions.ts`, staff in `staff.ts`) go through `pay()` in `payouts.server.ts`: one tx per call, unique `bot_payouts` id, never resent when uncertain. Staff claims need no signature since funds only go to the registered wallet.
