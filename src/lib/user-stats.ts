export type UserStats = {
  wallets: number;
  wallets_1d: number;
  wallets_7d: number;
  creators: number;
  profiles: number;
  comment_authors: number;
  trades: number;
  coins: number;
  recent: { wallet: string; trades: number; last_at: string; name: string | null; avatar: string | null; pnl_hbar?: number | null }[];
};

export type UserRow = { wallet: string; label: string; trades: number; last_at: string; avatar: string | null; pnl_hbar: number | null };

export type PnlTrade = { trader: string; token: string; is_buy: boolean; hbar_amount: number; token_amount: number; fee: number };
export type PnlCoin = { address: string; virtual_hbar: number; virtual_tokens: number; graduated: boolean };

/** Total site-trade result: sale receipts + estimated remaining value - buy costs.
 * Event buy amounts exclude fees; event sell amounts are gross before fees.
 * Positions are inferred from trades, not external transfers. Graduated open
 * positions have no current DEX price here, so their result is unavailable.
 */
export function walletPnl(wallets: string[], trades: PnlTrade[], coins: PnlCoin[]): Map<string, number | null> {
  const prices = new Map(coins.map((c) => [c.address.toLowerCase(), c]));
  const results = new Map<string, number | null>();
  const accounts = new Map<string, { cash: number; positions: Map<string, number> }>();
  for (const wallet of wallets) accounts.set(wallet.toLowerCase(), { cash: 0, positions: new Map() });
  for (const t of trades) {
    const account = accounts.get(t.trader.toLowerCase());
    if (!account) continue;
    account.cash += t.is_buy ? -(Number(t.hbar_amount) + Number(t.fee)) : Number(t.hbar_amount) - Number(t.fee);
    const token = t.token.toLowerCase();
    account.positions.set(token, (account.positions.get(token) ?? 0) + (t.is_buy ? 1 : -1) * Number(t.token_amount));
  }
  for (const wallet of wallets) {
    const account = accounts.get(wallet.toLowerCase());
    if (!account) continue;
    let total: number | null = account.cash;
    for (const [token, amount] of account.positions) {
      if (Math.abs(amount) < 0.00000001) continue;
      const coin = prices.get(token);
      if (amount < 0 || !coin || coin.graduated || Number(coin.virtual_tokens) <= 0) {
        total = null;
        break;
      }
      total += amount * Number(coin.virtual_hbar) / Number(coin.virtual_tokens);
    }
    results.set(wallet, total !== null && Number.isFinite(total) ? total : null);
  }
  return results;
}

/** Recent wallets with a display label: the profile name when they made one, otherwise the short address. */
export function userRows(stats: UserStats | undefined): UserRow[] {
  return (stats?.recent ?? [])
    .slice(0, 12)
    .map((r) => ({
      wallet: r.wallet,
      label: r.name?.trim() || `${r.wallet.slice(0, 6)}…${r.wallet.slice(-4)}`,
      trades: Number(r.trades) || 0,
      last_at: r.last_at,
      avatar: r.avatar ?? null,
      pnl_hbar: r.pnl_hbar ?? null,
    }));
}
