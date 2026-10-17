export type UserStats = {
  wallets: number;
  wallets_1d: number;
  wallets_7d: number;
  creators: number;
  profiles: number;
  comment_authors: number;
  trades: number;
  coins: number;
  recent: { wallet: string; trades: number; last_at: string; name: string | null; avatar: string | null }[];
};

export type UserRow = { wallet: string; label: string; trades: number; last_at: string; avatar: string | null };

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
    }));
}
