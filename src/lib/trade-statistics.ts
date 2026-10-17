export const TRADE_WINDOWS = { "5m": 5 * 60_000, "1h": 60 * 60_000, "1d": 24 * 60 * 60_000 } as const;
export type TradeWindow = keyof typeof TRADE_WINDOWS;
export type StatisticsTrade = { created_at: string; is_buy: boolean; hbar_amount: number | string; trader: string };

export function tradeStatistics(trades: StatisticsTrade[], window: TradeWindow, now: number) {
  const buys = { count: 0, volume: 0, wallets: new Set<string>() };
  const sells = { count: 0, volume: 0, wallets: new Set<string>() };
  for (const trade of trades) {
    const time = Date.parse(trade.created_at);
    if (!Number.isFinite(time) || time < now - TRADE_WINDOWS[window] || time > now) continue;
    const side = trade.is_buy ? buys : sells;
    side.count++;
    side.volume += Number(trade.hbar_amount);
    side.wallets.add(trade.trader.toLowerCase());
  }
  return {
    buys: { count: buys.count, volume: buys.volume, wallets: buys.wallets.size },
    sells: { count: sells.count, volume: sells.volume, wallets: sells.wallets.size },
  };
}