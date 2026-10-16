# Coins as standard Hedera tokens + automatic SaucerSwap listing

## What changes for users
- Every new coin becomes a standard Hedera token (the same kind as the coins on SaucerSwap). It shows up in HashPack with its name and is visible on HashScan.
- Buying and selling works on the curve as before. Before your first purchase of a coin, HashPack asks once to "add" (associate) the token. Before your first sale, HashPack asks once for permission to send the coins. Those are one-time extra approvals per coin.
- At graduation (800M sold) the contract itself creates a SaucerSwap pool for the coin with all the HBAR raised plus the remaining coins. After that the coin trades on SaucerSwap and appears on DexScreener automatically, just like 2FingersInu.
- The SaucerSwap pool fee (now about $50 in HBAR) is paid from the raised HBAR, not by you. The pool shares go to a dead address so the liquidity can never be withdrawn (no rug pull).

## Costs
- Creating a coin costs a bit more because Hedera charges about $1 to create a token. The app shows the exact price before you approve.
- Deploying the new contract costs about 30 HBAR from your wallet (already agreed). Coins on the current contract (your test coin) stay there and are not moved.

## Order of work
1. Rewrite the contract: create tokens through Hedera's token service, buy/sell through it, and add liquidity to SaucerSwap automatically at graduation (V1 router 0.0.3045981, WHBAR 0.0.1456986).
2. Adjust the app: the one-time "add token" and "allow selling" steps, token balance from Hedera, creation price including the token fee.
3. Test everything on Hedera testnet first, including a graduation on SaucerSwap testnet with a small curve. Only then will I ask you to top up HBAR and deploy on mainnet.
4. Switch the app over to the new contract; old coins stay visible.

## Technical details
- HTS precompile 0x167: createFungibleToken with the contract as treasury and supply key, 1B supply, 8 decimals (HTS max is int64, so 18 decimals do not fit).
- Buy: contract transfers HTS from the treasury to the buyer; the buyer must be associated (check via the mirror node, otherwise send TokenAssociateTransaction).
- Sell: user approves the contract once via AccountAllowanceApproveTransaction, then the contract calls transferFrom.
- Graduation: the contract approves the router and calls addLiquidityETHNewPool with payable = raised HBAR + pairCreateFee (read from factory 0.0.1062784, converted via the exchange-rate precompile 0x168); LP to 0x…dEaD. The contract needs a max auto-association so it can receive the LP token.
- syncChain, curve.ts, DexScreener adapter and decimals (8 instead of 18) will be adjusted to match.
