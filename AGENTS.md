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

- On-chain logic lives in `contracts/HederaPump.sol`; recompile with `bun contracts/compile.mjs` into `src/lib/contract-artifact.json` — the app encodes calls from that ABI, so they must stay in sync.
- Network, deployed contract ID and WalletConnect ID live in `src/lib/hedera-config.ts` — one place to switch networks or contracts.
- Coin/trade tables are filled only by `syncChain` from Hedera mirror-node events — the chain is the source of truth, never write them from user input.
- Browser Node polyfills in Vite must resolve directly to absolute npm package files, only in the client environment; re-resolving bare built-ins can recurse through aliases and exhaust the build.
- Wallet SDKs (hedera-wallet-connect, hiero sdk, web3auth, grpc-js) are stubbed out of server builds in `vite.config.ts` and may only be loaded via dynamic import in browser code — on the Worker they crash at load and the bundler merges viem/ethers into their chunk, which broke every server function (PIN, sync, bot).
- HashPack deployment uses explicit file-create, file-append, and contract-create transactions with a public mirror-node account key; ContractCreateFlow calls an unimplemented WalletConnect signer method.
- Deploy sends one wallet request per user tap, tags each tx memo `hpump:<fp>:<offset>:<len>`, and rebuilds progress from mirror-node history — mobile wallets miss requests sent while the browser is backgrounded, and nothing may be paid twice.
- DexScreener adapter lives in `src/routes/api/public/dexscreener/*` (read-only, from synced tables); block numbers are Unix seconds because Hedera has no EVM blocks — DexScreener needs monotonic integers.
- Next-gen launchpad (native HTS tokens, 8 decimals, auto SaucerSwap listing) is `contracts/HederaPumpHTS.sol`, compiled by `contracts/compile-hts.mjs` into `src/lib/contract-artifact-hts.json`; kept separate so the live contract artifact stays untouched until the switch.
- Pin `protobufjs` >=8.6.6 at the root: `@hiero-ledger/proto` (via hedera-wallet-connect) needs `Reader.tag()`; older 8.0.0 breaks wallet transactions with "e.tag is not a function".
- Wallet transactions are frozen for the multi-node list `WALLET_NODE_IDS` in `hedera-config.ts`, never a single node — HashPack rejects unknown nodes and fails outright when its only node is busy.
- Coins carry a `contract` column; every trade/quote/claim path must branch on it via `isV2`/`tokenUnit` in `src/lib/curve.ts` (v1: 18-dec ERC20 in-contract, v2: 8-dec HTS with associate/allowance steps) — never assume one contract or one decimal count.
- v3 contract `contracts/HederaPumpV3.sol` (compile-v3.mjs → contract-artifact-v3.json) shares the HTS ABI, so v2+v3 are both encoded with `encodePumpV2` and grouped in `HTS_CONTRACTS`; new coins go to `LATEST_CONTRACT_ID` — avoids per-version branches everywhere.
- Auto-buy bot (`src/lib/bot.server.ts`, key derived from BOT_SEED) runs one transaction step per scheduled call to `/api/public/jobs/autobuy`, tracked in `bot_buys` (token unique) — scheduled requests are short and a coin must never be bought twice.
- Daily X posting uses a managed authenticated schedule, server-only OAuth1 credentials, a database lease and unique slots; uncertain sends pause instead of retrying because X has no posting idempotency key. Images are bundled branded assets and no background AI calls are needed.
- Telegram uses a persisted message ID and lease for hourly edits; chain-derived graduation transitions enqueue unique alerts dispatched after sync, with uncertain sends held for review to prevent duplicate messages.
- Wallet profile display uses the shared useProfiles hook, resolving Hedera account IDs through mirror-node EVM aliases with long-zero fallback so holders and trades show the same identity.
- The sitemap uses required route-level staticData.sitemap decisions and paginated public-key token reads; exclude private surfaces and omit non-authoritative lastmod dates so search discovery stays safe and complete.
