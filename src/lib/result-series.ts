export type ResultTrade = { is_buy: boolean; hbar_amount: number | string; created_at: string };
export const RESULT_RANGES = { "1D": 864e5, "1W": 7 * 864e5, "1M": 30 * 864e5, All: Infinity } as const;
export type ResultRange = keyof typeof RESULT_RANGES;

/**
 * Running trading result in HBAR: sells add, buys subtract (fee-inclusive amounts as traded).
 * It is cash flow only — coins still held are not valued here.
 */
export function resultSeries(trades: ResultTrade[], range: ResultRange, now = Date.now()) {
  const sorted = [...trades].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const from = now - RESULT_RANGES[range];
  let total = 0;
  let start = 0;
  const points: { t: number; v: number }[] = [];
  for (const tr of sorted) {
    const t = Date.parse(tr.created_at);
    const amt = Number(tr.hbar_amount) || 0;
    total += tr.is_buy ? -amt : amt;
    if (t < from) start = total;
    else points.push({ t, v: total });
  }
  const series = [{ t: Number.isFinite(from) ? from : (points[0]?.t ?? now), v: start }, ...points, { t: now, v: total }];
  return { series, change: total - start };
}
