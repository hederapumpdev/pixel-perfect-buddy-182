// Browser-safe Hold Out + fee-split rules. All amounts are integer tinybars / token units.

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Of the platform's 70% fee share: team 20%, Hold Out 10%, platform 40% of the total fee. */
export const SPLIT_PARTS = { team: 2n, holdout: 1n, platform: 4n } as const;
export const SPLIT_TOTAL = 7n;

/** Splits a forwarded amount 2/7 team, 1/7 Hold Out, rest (≈4/7) platform — never more than the input. */
export function splitAmounts(tinybars: bigint) {
  if (tinybars <= 0n) return { team: 0n, holdout: 0n, platform: 0n };
  const team = (tinybars * SPLIT_PARTS.team) / SPLIT_TOTAL;
  const holdout = (tinybars * SPLIT_PARTS.holdout) / SPLIT_TOTAL;
  return { team, holdout, platform: tinybars - team - holdout };
}

export const HOLDOUT_MIN_DAYS = 7;
export const HOLDOUT_LOYALTY_DAYS = 60;
export const HOLDOUT_SNAPSHOTS = 4;
/** Below this a wallet's weekly reward is not sent; it rolls into next week's pot. */
export const HOLDOUT_MIN_PAYOUT_TINYBARS = 10_000_000n; // 0.1 HBAR
/** First week Hold Out counts (Monday 00:00 UTC). */
export const HOLDOUT_START = "2026-10-26T00:00:00Z";

/** Monday 00:00 UTC of the week containing `d`. */
export function periodStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY);
}
export const periodKey = (start: Date) => start.toISOString().slice(0, 10);

/** The 4 fixed snapshot moments of a week: Mon 00:00, Tue 18:00, Thu 12:00, Sat 06:00 UTC. */
export function snapshotSlots(start: Date): Date[] {
  return Array.from({ length: HOLDOUT_SNAPSHOTS }, (_, k) => new Date(start.getTime() + k * 42 * HOUR));
}

/** Loyalty multiplier in parts-per-million: 1 + min(D/60, 1) → 1.0×…2.0×. */
export function loyaltyPpm(ageMs: number): bigint {
  const age = BigInt(Math.max(0, Math.floor(ageMs)));
  const cap = BigInt(HOLDOUT_LOYALTY_DAYS * DAY);
  return 1_000_000n + (age >= cap ? 1_000_000n : (age * 1_000_000n) / cap);
}
export const isQualified = (ageMs: number) => ageMs >= HOLDOUT_MIN_DAYS * DAY;

export type Lot = [amount: string, acquiredMs: number];

/**
 * Moves a wallet's lots to a new balance. Extra tokens get their own lot (their own age);
 * a lower balance removes the newest lots first, so older holdings keep their age.
 */
export function updateLots(lots: Lot[], balance: bigint, at: number): Lot[] {
  const out = lots.map(([a, t]) => [BigInt(a), t] as [bigint, number]).filter(([a]) => a > 0n);
  let total = out.reduce((s, [a]) => s + a, 0n);
  if (balance > total) out.push([balance - total, at]);
  while (total > balance && out.length) {
    const last = out[out.length - 1]!;
    const cut = total - balance < last[0] ? total - balance : last[0];
    last[0] -= cut;
    total -= cut;
    if (last[0] === 0n) out.pop();
  }
  return out.map(([a, t]) => [a.toString(), t]);
}

/** Σ(qualifying lot amount × loyalty ppm). Lots younger than 7 days add nothing. */
export function lotWeight(lots: Lot[], at: number): bigint {
  let w = 0n;
  for (const [a, t] of lots) if (isQualified(at - t)) w += BigInt(a) * loyaltyPpm(at - t);
  return w;
}

const SCALE = 10n ** 18n;
/**
 * W_i = (1/N) × Σ_t (lotWeight_i,t / S_t) — time-weighted ownership × loyalty, scaled 1e18·1e6.
 * `snapshots` are the week's snapshots for one coin; missing wallets count as 0.
 */
export function rewardWeights(snapshots: { supply: string; weights: Record<string, string> }[]) {
  const n = BigInt(Math.max(1, snapshots.length));
  const sum = new Map<string, bigint>();
  for (const s of snapshots) {
    const S = BigInt(s.supply || "0");
    if (S <= 0n) continue;
    for (const [acc, w] of Object.entries(s.weights)) sum.set(acc, (sum.get(acc) ?? 0n) + (BigInt(w) * SCALE) / S);
  }
  for (const [k, v] of sum) sum.set(k, v / n);
  return sum;
}

/** P_i = R × W_i / ΣW, rounded down; the remainder is returned as residual. Never exceeds R. */
export function allocate(pot: bigint, weights: Map<string, bigint>) {
  const total = [...weights.values()].reduce((s, w) => s + w, 0n);
  const out = new Map<string, bigint>();
  if (pot <= 0n || total <= 0n) return { payouts: out, residual: pot > 0n ? pot : 0n };
  let paid = 0n;
  for (const [k, w] of weights) {
    const p = (pot * w) / total;
    if (p > 0n) out.set(k, p);
    paid += p;
  }
  return { payouts: out, residual: pot - paid };
}

/** Drops wallets below the minimum payout; their amount joins the residual for next week. */
export function applyMinimum(payouts: Map<string, bigint>, min = HOLDOUT_MIN_PAYOUT_TINYBARS) {
  const kept = new Map<string, bigint>();
  let rolled = 0n;
  for (const [k, v] of payouts) (v >= min ? kept.set(k, v) : (rolled += v));
  return { kept, rolled };
}
