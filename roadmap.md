# Roadmap
- [x] Coin page: show the contract address (CA) and creator clearly, with copy buttons and links
- [x] HTS + SaucerSwap contract written and compiling (contracts/HederaPumpHTS.sol)
- [x] Testnet test (contract 0.0.11049553): create, buy, sell, graduation, SaucerSwap pool all work. Pool step needs ~7.6M gas (~21 HBAR).
- [x] Retest: graduating buy with 15M gas auto-listed on SaucerSwap testnet in the same tx (token 0.0.11049873, pair 0.0.11049878 holds the 200M).
- [ ] App: one-time "add token" / "allow selling" steps, 8-decimal amounts, per-contract coins, 15M gas on the graduating buy
- [ ] Mainnet deploy of the new contract — waits on HBAR top-up
- [ ] DexScreener listing request (user submits; waits on DexScreener)
