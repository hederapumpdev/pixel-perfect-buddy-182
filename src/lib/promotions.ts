// Browser-safe promotion rules: official coins, weekly launch contest, free first coins.
import { FEE_WALLET_EVM } from "./hedera-config";

/** Creators whose coins are labelled "Official" (the team's own wallets). */
export const OFFICIAL_CREATORS: string[] = [FEE_WALLET_EVM];
export const isOfficial = (creator: string | null | undefined) =>
  !!creator && OFFICIAL_CREATORS.some((c) => c.toLowerCase() === creator.toLowerCase());

/** Weekly contest: the coin with the most volume (Mon 00:00 – Mon 00:00 UTC) wins. */
export const CONTEST_PRIZE_HBAR = 100;
export const CONTEST_MIN_VOLUME_HBAR = 1000; // below this, nobody wins that week

/** Free first coin: the creation fee is refunded to the first N new creators after PROMO_START. */
export const FREE_COIN_LIMIT = 10;
export const PROMO_START = "2026-10-17T18:00:00Z";

const DAY = 86_400_000;
/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // Mon = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY);
}
export const weekKey = (start: Date) => start.toISOString().slice(0, 10);

export type ContestTrade = { token: string; hbar_amount: number | string; created_at: string };
export type ContestEntry = { token: string; volume: number };

/** Volume per coin inside [from, to), official coins excluded, highest first. */
export function contestLeaderboard(
  trades: ContestTrade[],
  creatorOf: (token: string) => string | undefined,
  from: Date,
  to: Date,
): ContestEntry[] {
  const vol = new Map<string, number>();
  for (const t of trades) {
    const at = new Date(t.created_at).getTime();
    if (at < from.getTime() || at >= to.getTime()) continue;
    if (isOfficial(creatorOf(t.token))) continue;
    vol.set(t.token, (vol.get(t.token) ?? 0) + Number(t.hbar_amount));
  }
  return [...vol].map(([token, volume]) => ({ token, volume })).sort((a, b) => b.volume - a.volume);
}

export const contestWinner = (board: ContestEntry[]) =>
  board[0] && board[0].volume >= CONTEST_MIN_VOLUME_HBAR ? board[0] : null;
