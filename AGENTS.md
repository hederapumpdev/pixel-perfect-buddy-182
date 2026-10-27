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

- Subdirectories have their own `AGENTS.md` (`contracts/`, `src/lib/`); read it before changing files there.
- Staff allocations are capped transactionally by a database trigger; removal uses retained inactive rows so earned funds and payout history remain claimable.
- Home-screen support is manifest-only with brand icons; offline workers require explicit user request to avoid stale previews.
- Network, contract IDs and WalletConnect ID live in `src/lib/hedera-config.ts` for centralized configuration.
- Failed v4 deployments stay indexed/tradable. Legacy replacement has a separate ID/artifact; creation requires verified mainnet creation to avoid paid retries. Admin targets the pending legacy artifact.
- Coin/trade tables are filled only by `syncChain` from Hedera mirror-node events — the chain is the source of truth, never write them from user input.
- Browser Node polyfills in Vite resolve directly to absolute npm package files, client-only; re-resolving bare built-ins recurses through aliases and exhausts the build.
- Wallet SDKs are stubbed server-side in `vite.config.ts`; dynamically import in browsers only to avoid Worker crashes.
- Wallet setup, pairing, picker and approval have separate deadlines; ignore late URIs and defer dismissal until approval settles. Verify SDK client after init. Never auto-retry transactions.
- Statistics/PnL paginate trades; USD uses current HBAR rate. PnL = net sells + curve value - fee-inclusive buys; label estimates, omit unpriced positions and transfers/network fees. Buyers/sellers distinct per side.
- HashPack deploy uses file-create/append and contract-create with mirror account key (ContractCreateFlow calls an unsupported signer method); one wallet request per user tap, tx memo `hpump:<fp>:<offset>:<len>`, progress rebuilt from mirror-node history — backgrounded mobile browsers miss requests, and nothing may be paid twice.
- DexScreener adapter lives in `src/routes/api/public/dexscreener/*` (read-only, from synced tables); block numbers are Unix seconds because Hedera has no EVM blocks — DexScreener needs monotonic integers.
- Pin `protobufjs` >=8.6.6 at the root: `@hiero-ledger/proto` (via hedera-wallet-connect) needs `Reader.tag()`; older 8.0.0 breaks wallet transactions with "e.tag is not a function".
- Wallet transactions are frozen for the multi-node list `WALLET_NODE_IDS` in `hedera-config.ts`, never a single node — HashPack rejects unknown nodes and fails outright when its only node is busy.
- Coins carry a `contract` column; every trade/quote/claim path must branch on it via `isV2`/`tokenUnit` in `src/lib/curve.ts` (v1: 18-dec ERC20 in-contract, v2: 8-dec HTS with associate/allowance steps) — never assume one contract or one decimal count.
- All scheduled social posting (daily X, Telegram top-10/app/graduation, Discord new-coins, and `promo.server.ts` contest/weekly/graduation/spotlight/Discord-mirror) uses managed authenticated schedules, unique database slot/lease claims and one external send per call; uncertain sends are marked and never retried (X has no idempotency key). Because one call only settles the first unsettled channel, every schedule must fire at least once per channel per slot, and a choice made for a slot (the spotlight coin) is stored on its claim row so all channels announce the same item. Images are bundled branded assets uploaded through the gateway; Discord disables mentions and reads the exact HTS memo from Hedera.
- Profiles use useProfiles for alias identity; HederaAddress resolves display IDs only, preserving chain/database addresses.
- The sitemap uses required route-level staticData.sitemap decisions and paginated public-key token reads; exclude private surfaces and omit non-authoritative lastmod dates.
- Referral links: ?ref=<wallet> captured once into localStorage (src/lib/referral.ts, first referrer wins) and sent with every v4 trade; profile shows the Referrals block only when PUMP_CONTRACT_V4_ID is set.
- Legacy SaucerSwap assistance exports synced pre-v4 HTS information client-side with Davinci Pics guidance; never imply submission success or attempt metadata updates because those tokens lack update keys.
- BondingProgress uses synced reserves for a display-only HBAR/USD graduation estimate, including the existing fee; never use it to execute trades.
- Token logo submission packages are client-side exports of synced coin data; external forms remain manual, with no automatic-submission or approval claims.
- Admin access = owner PIN or a short-lived HMAC session from a wallet-signed login by an active staff member with is_admin; every admin server fn goes through requireAdmin in admin-auth.server.ts so removal revokes access immediately.
- Community chat uses wallet-signed, expiring server-verified sessions for the existing WalletConnect/social wallets; public reads exclude removed messages, and transactional per-wallet rate limits and blocks guard every post. Moderation always requires requireAdmin.
- Markets rows come only from SaucerSwap pools plus our own chain-synced coins; bonding-curve coins carry no liquidity or price-change figure, link to the coin page, and never claim SaucerSwap data; "New" sorts by Hedera entity number (creation order); only hate speech (slurs, Nazi and child-abuse words) is hidden from the display list — ordinary profanity is listed like any other coin.
- Markets token information uses public Mirror Node balances/metadata and SaucerSwap V1 pools; bounded holder pagination labels incomplete counts as lower bounds, and LP burn/lock remain unknown without verified evidence — prevents false safety claims.
- Imported wallets: private key encrypted with a user PIN (PBKDF2+AES-GCM) in localStorage via `src/lib/local-wallet.ts`, decrypted only into memory and signed via an SDK operator client; never send keys to the server.
- Web3Auth v11 has no `web3auth.provider`; read the sign-in key via `signinProvider()` in `src/lib/wallet.tsx` (primary connector's provider), otherwise logins reach "authorized" but never attach.
- Opening a SaucerSwap pool goes through `src/lib/sol-pool.ts` only: the creation fee is read live from the factory and converted with Hedera's exchange rate, and the bot wallet must already hold both sides before anything is sent — never estimate the fee or fund a pool automatically.
- Profile edits are proven by a fresh wallet signature over the exact content (profile-message.ts, verifyWalletSignature); the old device edit key is retired — replays can only re-save identical data. X handles are shown as unverified links.
- Follows are stored by Hedera account ID in `wallet_follows` (server-only access); every follow/unfollow is proven by a fresh wallet signature (`follow-message.ts`) so nobody can follow on behalf of another wallet.
- Graduated coins list in our own pools (`contracts/HederaPumpPool.sol`, `src/lib/pool.ts`) instead of SaucerSwap; the coin's liquidity stays with the people who provided it and no contract or admin can withdraw it for them, so the app must never promise that platform funds back a pool. The one coin already listed on SaucerSwap keeps its immovable pool there, and a pool is only usable once its contract is deployed and reviewed — say "not live yet" rather than implying a pool exists.
