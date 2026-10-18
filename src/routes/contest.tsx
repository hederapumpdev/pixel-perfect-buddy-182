import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { NETWORK } from "@/lib/hedera-config";
import { tokensQuery } from "@/lib/queries";
import { useUsd } from "@/lib/usd";
import { getContestPayouts } from "@/lib/contest.functions";
import {
  CONTEST_MIN_VOLUME_HBAR,
  CONTEST_PRIZE_HBAR,
  FREE_COIN_LIMIT,
  contestLeaderboard,
  weekStart,
} from "@/lib/promotions";

export const Route = createFileRoute("/contest")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Weekly launch contest — HederaPump" },
      { name: "description", content: `The coin with the most trading volume each week wins ${CONTEST_PRIZE_HBAR} HBAR for its creator.` },
      { property: "og:title", content: "Weekly launch contest — HederaPump" },
      { property: "og:description", content: `Win ${CONTEST_PRIZE_HBAR} HBAR every week, plus free coin launches for new creators.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contest,
});

function Contest() {
  const start = weekStart(new Date());
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const { data: tokens = [] } = useQuery(tokensQuery);
  const byAddr = new Map(tokens.map((t) => [t.address, t]));
  const usd = useUsd();
  const board = useQuery({
    queryKey: ["contest", start.toISOString()],
    queryFn: async () => {
      const rows: { token: string; hbar_amount: number; created_at: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("trades")
          .select("token,hbar_amount,created_at")
          .eq("network", NETWORK)
          .gte("created_at", start.toISOString())
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return rows;
    },
    refetchInterval: 30_000,
  });
  const payouts = useQuery({
    queryKey: ["contest-payouts"],
    queryFn: () => getContestPayouts(),
  });
  const ranked = contestLeaderboard(board.data ?? [], (a) => byAddr.get(a)?.creator, start, end).slice(0, 10);
  const winners = payouts.data?.winners ?? [];
  const refunds = payouts.data?.refunds ?? 0;
  const left = Math.max(0, FREE_COIN_LIMIT - refunds);
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);

  return (
    <Shell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Weekly launch contest</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The coin with the most trading volume this week wins <b className="text-primary">{CONTEST_PRIZE_HBAR} HBAR</b>
            {` (≈ ${usd(CONTEST_PRIZE_HBAR)})`} for its creator, paid automatically on Monday.
            Minimum {CONTEST_MIN_VOLUME_HBAR.toLocaleString()} HBAR volume. Official coins don't take part. Ends in {days} day{days === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
          <p className="font-semibold">Your first coin is free</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The first {FREE_COIN_LIMIT} new creators get their creation fee back automatically. {left} spot{left === 1 ? "" : "s"} left.
          </p>
          <Link to="/create" className="mt-2 inline-block text-sm font-semibold text-primary">Create a coin →</Link>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <p className="border-b border-border p-3 font-semibold">This week's leaderboard</p>
          {board.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : ranked.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No trades yet this week. Be the first!</p>
          ) : (
            ranked.map((r, i) => {
              const t = byAddr.get(r.token);
              return (
                <Link key={r.token} to="/token/$id" params={{ id: r.token }} className="flex items-center justify-between border-b border-border p-3 text-sm last:border-0 hover:bg-muted/40">
                  <span><b className="mr-2 font-mono text-muted-foreground">#{i + 1}</b>{t?.name ?? "?"} <span className="font-mono text-xs text-muted-foreground">${t?.symbol}</span></span>
                  <span className="font-mono">{r.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} ℏ</span>
                </Link>
              );
            })
          )}
        </div>

        {winners.length > 0 && (
          <div className="rounded-lg border border-border bg-card">
            <p className="border-b border-border p-3 font-semibold">Past winners</p>
            {winners.map((p) => {
              const t = p.token ? byAddr.get(p.token) : undefined;
              return (
                <div key={p.id} className="flex justify-between border-b border-border p-3 text-sm last:border-0">
                  <span>Week of {p.id.slice(6)} · {t?.name ?? "?"}</span>
                  <span className="font-mono text-primary">{Number(p.hbar_amount)} ℏ</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
