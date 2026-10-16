# Roadmap
- [x] Coin page: show the contract address (CA) and creator clearly, with copy buttons and links
- [x] HTS + SaucerSwap contract written and compiling (contracts/HederaPumpHTS.sol)
- [x] Testnet test (contract 0.0.11049553): create, buy, sell, graduation, SaucerSwap pool all work. Pool step needs ~7.5M gas (~21 HBAR); auto-listing in the graduating buy fails below that, manual migrate works at 15M.
- [ ] App: one-time "add token" / "allow selling" steps, 8-decimal amounts, per-contract coins, 15M gas on the graduating buy
- [ ] Mainnet deploy of the new contract — waits on HBAR top-up
- [ ] DexScreener listing request (user submits; waits on DexScreener)
