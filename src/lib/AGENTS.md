# src/lib rules

- Auto-buy bot (`bot.server.ts`, key derived from BOT_SEED) runs one transaction step per scheduled call to `/api/public/jobs/autobuy`, tracked in `bot_buys` (token unique) — scheduled requests are short and a coin must never be bought twice. The same bot wallet creates max 4 official coins/day (`official-coins.server.ts`, `official_coins` table, Official badge) themed on DexScreener trending.
- Bot buys use `encodeBotBuy` for contract-specific referral arguments; official launches persist a bundled original mascot hash before submission so chain-synced logos cannot be missing. Authenticated replacement calls bypass timing, never uniqueness or daily limits.
- Bot payouts (contest/refunds in `promotions.ts`, staff in `staff.ts`) go through `pay()` in `payouts.server.ts`: one tx per call, unique `bot_payouts` id, never resent when uncertain. Staff claims need no signature since funds only go to the registered wallet.
- Bot transactions (buys, payouts, official launches) use `botFee()` from `bot.server.ts` (legacy type with a floored gas price) — Hedera rejects ethers estimates below its minimum gas price.
- Discord routing lives in `promo.server.ts`: coin-specific posts go to the new-coins channel, platform news to announcements — keeps each channel on-topic.
- Official coins generate their own logo via `coin-image.server.ts` before claiming/paying (bundled mascot fallback) so no coin launches without an image and an aborted request costs nothing.
