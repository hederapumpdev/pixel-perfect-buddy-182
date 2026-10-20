// HederaPump Points — derived only from synced on-chain data (tokens + trades).
export const POINTS_PER_HBAR = 1;
export const POINTS_PER_COIN = 100;
export const POINTS_PER_GRADUATION = 500;

export type PointsRow = { wallet: string; points: number; volume: number; coins: number; graduated: number };

export function pointsLeaderboard(
  trades: { trader: string; hbar_amount: number | string }[],
  tokens: { creator: string; graduated: boolean }[],
): PointsRow[] {
  const m = new Map<string, PointsRow>();
  const get = (w: string) => {
    const k = w.toLowerCase();
    let r = m.get(k);
    if (!r) m.set(k, (r = { wallet: w, points: 0, volume: 0, coins: 0, graduated: 0 }));
    return r;
  };
  for (const t of trades) get(t.trader).volume += Number(t.hbar_amount) || 0;
  for (const t of tokens) {
    const r = get(t.creator);
    r.coins++;
    if (t.graduated) r.graduated++;
  }
  for (const r of m.values())
    r.points = Math.floor(r.volume * POINTS_PER_HBAR) + r.coins * POINTS_PER_COIN + r.graduated * POINTS_PER_GRADUATION;
  return [...m.values()].filter((r) => r.points > 0).sort((a, b) => b.points - a.points);
}
