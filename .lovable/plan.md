# Fees omdraaien, admin-overzicht en bot die elke nieuwe munt koopt

## Wat je krijgt
1. **Nieuw contract (v3)** voor munten die daarna gemaakt worden:
   - Het platformdeel (70% van de 1% fee) gaat bij elke trade **meteen naar je fee-wallet 0.0.10923241**.
   - Het makersdeel (30%) blijft in het contract staan. De maker haalt het op met **"Claim fees"** op zijn profiel.
   - Verder werkt alles zoals nu: echte Hedera-token, automatisch op SaucerSwap bij graduation.
   - Plaatsen kost ongeveer 30 HBAR en gaat via de admin-pagina, zoals vorige keer.
   - Bestaande munten blijven werken op hun eigen contract.
2. **Admin-overzicht**
   - Ontvangen platformfees: totaal, vandaag, deze week, per contract.
   - Per munt: hoeveel fee hij heeft opgeleverd.
   - **Toplijst:** munten gesorteerd op market cap, volume (24 uur) en hoe ver ze richting graduation zijn.
3. **Bot-wallet die automatisch koopt**
   - Een aparte Hedera-wallet, die van jouw HashPack gescheiden blijft. Jij zet er een klein bedrag HBAR op.
   - Elke paar minuten kijkt de app naar nieuwe munten en koopt van elke nieuwe munt **$2**. Het bedrag in HBAR volgt de actuele koers.
   - Elke munt wordt maar één keer gekocht, ook als er iets misgaat en opnieuw geprobeerd wordt.
   - In admin zie je het saldo van de bot, wat hij gekocht heeft, en een aan/uit-schakelaar.
   - Veiligheid: de bot kan alleen kopen op HederaPump. Op jouw fee-wallet kan hij niets doen. Is zijn saldo te laag, dan stopt hij vanzelf.

## Wat ik van jou nodig heb
- Ongeveer 30 HBAR op de fee-wallet voor het plaatsen van het nieuwe contract. Waarschijnlijk staat daar nog genoeg op.
- De bot-wallet maak ik zelf aan. Daarna stuur jij er HBAR naartoe, bijvoorbeeld 50 HBAR voor ongeveer 300 munten.

## Technical details
- `contracts/HederaPumpV3.sol` (copy of HTS contract): `_takeFee` sends the platform share to `feeRecipient` via call (on failure it accrues to `platformFees`), and the creator share always accrues to `creatorFees`. Compile with a new script into `contract-artifact-v3.json`. Test on testnet first, then deploy through admin and set `PUMP_CONTRACT_V3_ID` in `hedera-config.ts`, adding it to `PUMP_CONTRACTS`. Branch in `curve.ts` (v3 behaves like v2 for decimals and associate).
- Sync: store `fee` per trade (already in the Trade event) and make sure the `trades.fee` column exists. Admin aggregates come from synced tables.
- Bot: an ECDSA key in the `BOT_PRIVATE_KEY` secret, account created via a transfer to its EVM alias. Route `/api/public/jobs/autobuy`, protected with `authenticateCronRequest`, on a schedule every 5 minutes. A `bot_buys` table (unique token) is written only by the server. USD price comes from the mirror `network/exchangerate`. Before each buy it associates the token via HTS. The `bot_settings` table holds enabled and usd_amount, toggled from admin through a server function that checks the fee wallet signature.
