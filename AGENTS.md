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
- HashPack deployment uses explicit file-create, file-append, and contract-create transactions with a public mirror-node account key; ContractCreateFlow calls an unimplemented WalletConnect signer method.
