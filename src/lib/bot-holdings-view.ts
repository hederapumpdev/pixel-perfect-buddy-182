/**
 * Admin bot-coin list rules.
 *
 * Coins the bot no longer holds (fully sold back to HBAR) are dropped from the
 * list, but their realised result stays in the all-time total so the headline
 * number keeps matching what the bot actually did.
 */

export type BotHoldingRow = {
  address: string;
  name: string;
  symbol: string;
  graduated: boolean;
  tokens: number;
  hbarOut: number;
  spent: number;
  received: number;
  profit: number;
};

export function botHoldingViews(rows: BotHoldingRow[]) {
  const held = rows.filter((c) => c.tokens > 0);
  const priced = rows.filter((c) => !(c.graduated && c.tokens > 0));
  return {
    held,
    soldOut: rows.length - held.length,
    total: priced.reduce((a, c) => a + c.profit, 0),
  };
}
