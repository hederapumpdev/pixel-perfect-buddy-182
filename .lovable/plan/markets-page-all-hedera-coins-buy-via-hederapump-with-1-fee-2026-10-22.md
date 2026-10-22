# Markets page: all Hedera coins, buy via HederaPump with 1% fee

## What users get
- A new page **Markets** (`/markets`) listing every Hedera token that has an HBAR pool on SaucerSwap, also coins not made on HederaPump.
- DexScreener-style table: logo, name/ticker, price (HBAR + USD), 24h change, 24h volume, liquidity, market cap. Search by name, ticker or Hedera ID (0.0.x). Sort by volume, liquidity, newest.
- A detail page per token (`/markets/0.0.x`) with a price chart and a Buy/Sell box.
- Buying/selling runs through our own swap contract: one HashPack approval, 1% fee goes to the bot wallet (then split automatically team/Hold Out/platform like all other fees), the rest is swapped on SaucerSwap. The fee is shown clearly before confirming — never hidden.
- HederaPump coins in the list link to their own coin page as now.

## Honest limits
- Prices and pools come from SaucerSwap; we do not hold anyone's coins.
- Selling a token needs a one-time token approval (allowance) for our swap contract, plus token association when buying a token the wallet has never held.
- Scam/rug tokens exist on SaucerSwap. We show a warning label for tokens with very low liquidity and a general "not verified by HederaPump" notice.
- People can still trade the same tokens directly on SaucerSwap without our fee; our value is the overview + convenience.

## Steps
1. Data: server-side reader of SaucerSwap token/pool data (cached a few minutes) + Hedera mirror node for token details. If SaucerSwap requires an API key, I ask you to request one (free) and add it.
2. Markets list page + token detail page with chart and safety labels.
3. Swap contract `HederaPumpRouter`: takes 1% of HBAR in (buy) or of HBAR out (sell), forwards to bot wallet, calls SaucerSwap router with slippage limit from the user. Fee recipient changeable only by owner; fee capped in code at 1%.
4. Local tests of the contract (fee math, slippage, refund on failure) and of the price/fee display.
5. Deploy: you approve the contract creation once with your wallet (costs a few HBAR). Trading stays off until deployment is verified on mainnet.
6. Fee-split job picks up router fees automatically (they arrive in the bot wallet).
7. Add "Markets" to the menu, sitemap, and announce on X/Telegram/Discord after you confirm.

## Technical details
- Router: Solidity, uses SaucerSwap V1 router `swapExactETHForTokens` / `swapExactTokensForETH` (verified mainnet address in `hedera-config.ts`), WHBAR path; checks-effects-interactions, reentrancy guard, `minOut` from client quote minus slippage.
- Quotes via router `getAmountsOut` read through mirror-node contract call.
- New coin table is NOT written from user input; market data is display-only, cached server-side.
- Wallet flow follows existing rules: one request per tap, multi-node `WALLET_NODE_IDS`, no auto-retry.
