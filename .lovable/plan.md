# Three-wallet fee split + Hold Out rewards (automatic payouts)

## What you get
- Every trade fee: 30% creator (unchanged), 20% team, 10% Hold Out, 40% platform (0.0.10923241).
- Works for existing AND new coins.
- Team members, referrals, contest prizes and Hold Out holder rewards are paid automatically. Nobody needs to approve payouts by hand.
- A new Hold Out page shows each coin's reward pot, your estimated reward, and the payout history.

## How existing coins can join
The existing contracts let the owner change who receives the 70%. With one wallet approval from you, we point that to a new **split wallet** that the site manages. The split wallet forwards what comes in automatically:
- 2/7 to the team wallet
- 1/7 to the Hold Out wallet
- 4/7 to your platform wallet 0.0.10923241

You don't have to give the site your own wallet key.

## New wallets (created by the site, keys stored securely as secrets)
1. Split wallet: receives the 70%, forwards it every hour.
2. Team wallet: pays staff shares automatically. This replaces the bot wallet top-ups for staff.
3. Hold Out wallet: pays referrals, the weekly contest prize and weekly holder rewards.

Each wallet needs about 5 HBAR to open, paid from the bot wallet. Each payout costs a small network fee.

## Hold Out rules (from your document, without burns)
- Weekly payout in HBAR from the Hold Out wallet. The pot is split over coins in proportion to the fees each coin generated that week.
- The site checks balances several times a week. Only wallets that have held for at least 7 days take part. The longer you hold, the bigger your share: 1.0x at the start, up to 2.0x at 60 days. Newly bought tokens start with their own age.
- These don't take part: the curve/contract, SaucerSwap pools, creator and platform wallets, and the bot.
- Very small amounts roll over to next week. We never pay out more than the pot. There is no guaranteed return.

## Referrals and contests
- The v4 referral pool in the contract stays as it is.
- Contest prizes and the 10% referral share for older coins come from the Hold Out wallet.

## Safety
- Every payout is recorded with a unique ID before it is sent. An uncertain send is marked and never sent twice.
- Each wallet keeps a minimum balance. Admin shows all three balances and every payout.

## Order of work
1. Create the three wallets and the payout records. Build the hourly split.
2. Move automatic staff and contest payouts over to the new wallets.
3. Build Hold Out: snapshots, weekly calculation, payouts, page and profile block. Add tests for the 7-day rule, the 2x cap, rounding and the pot limit.
4. You approve one wallet transaction to point existing contracts to the split wallet. The new contract in the draft uses the same split wallet.

## Technical details
- Splitter, team payer and Hold Out payer are server-held ED25519 accounts. Their keys are stored as secrets and loaded only inside scheduled routes.
- Ledger tables are service-role only. Each payout has a unique (period, recipient) key and is claimed before it is sent.
- Snapshots come from the mirror node token balances 4 times a week. Acquisition lots are rebuilt from synced trades and transfers.
- Calls `setFeeRecipient` on v2/v3/v4/legacy contracts, signed by the owner wallet in the admin panel.
