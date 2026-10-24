# HBAR/SOL pool preparation

Checked 24 October 2026 at approximately 09:48 UTC. Preparation only: no funding, approval, pool creation or publishing performed.

## Intended pair

- SaucerSwap V1 on Hedera mainnet: WHBAR `0.0.1456986` / SOL representation `0.0.10807298` (8 decimals).
- This is not a native Solana pool and does not pair SOL directly with the official HEDERAPUMP token `0.0.10924337`.
- A pool alone does not enable cross-chain transfers. Any Solana-to-Hedera entry remains dependent on SODAX supporting the requested assets and transfer.
- Admin already has a Solana pool panel. Nothing should be sent until the owner chooses a size and explicitly approves spending.

## Verified public reads

- Direct factory `getPair` result: `0x0000000000000000000000000000000000000000000000000000000000000000` (no V1 pool at this snapshot).
- Factory creation fee converted at Hedera's current exchange rate: **648.16375209 HBAR**, approximately **$50** at the protocol exchange rate. This is a one-time expense, not liquidity.
- Bot account `0.0.10927104`: **44.02676364 HBAR**; SOL token query returned no association/balance entry.
- SOL metadata: Solana / SOL; memo “Solana (SOL) - Hedera spoke.” Hedera representation, not native Solana SOL.
- CoinGecko spot reference: SOL $101.13, HBAR $0.076235; **1 SOL ≈ 1,326.556 HBAR**. This is indicative, not an executable swap quote or proof of redemption value.

## Illustrative sizes, not a selected budget

HBAR required includes matching liquidity, the creation fee and the existing 5 HBAR reserve. The SOL deposit must be supplied separately, as the correct Hedera token. Never send native SOL to the Hedera account.

| SOL deposited | Matching HBAR liquidity | HBAR needed including fee + reserve | HBAR top-up versus snapshot balance |
| --- | ---: | ---: | ---: |
| 0.1 SOL | 132.66 | 785.82 | 741.80 |
| 1 SOL | 1,326.56 | 1,979.72 | 1,935.70 |
| 5 SOL | 6,632.78 | 7,285.94 | 7,241.92 |

Top-ups rounded upward. Balances, fees and reference prices must be refreshed before funding. Gas costs are not verified by this snapshot; the 5 HBAR reserve is the existing application's buffer, not a guaranteed maximum. A tiny pool has high price impact. LP tokens from this admin path go to the bot wallet; no permanent-lock claim is warranted.

## Before any paid activation

1. Obtain the owner's chosen liquidity size and explicit spending approval; do not move fee/team/Hold Out funds automatically.
2. Verify SODAX support and how to acquire/transfer this exact Hedera SOL token; verify association requirements before funding. Do not imply native SOL can be sent to a Hedera account.
3. Re-read the factory pair directly and verify token-order/response decoding. The existing helper currently converts a 32-byte return into bigint while `solPoolExists` checks only strings; its detection must be corrected and regression-tested for an existing nonzero pair before using the creation path.
4. Refresh the fee, both balances and market reference price; verify liquidity ratio and network-cost headroom.
5. Verify the existing admin flow under a real admin session. This preparation did not exercise signed-in UI or a paid transaction.
6. Approval and creation remain separate explicit actions; never retry an uncertain send. Verify receipt, actual pair address/reserves and LP recipient before announcing availability.

Existing HEDERAPUMP and all other coins are unchanged.