import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { HederaAddress, ProfileLink } from "@/components/HederaAddress";
import { supabase } from "@/integrations/supabase/client";
import { NETWORK } from "@/lib/hedera-config";
import { tokensQuery } from "@/lib/queries";
import { POINTS_PER_COIN, POINTS_PER_GRADUATION, POINTS_PER_HBAR, pointsLeaderboard } from "@/lib/points";

export const Route = createFileRoute("/leaderboard")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Points leaderboard — HederaPump" },
      { name: "description", content: "Earn HederaPump Points by trading, creating coins and graduating them to SaucerSwap." },
      { property: "og:title", content: "Points leaderboard — HederaPump" },
      { property: "og:description", content: "Top traders and creators on HederaPump, ranked by points." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { data: tokens = [] } = useQuery(tokensQuery);
  const trades = useQuery({
    queryKey: ["points-trades"],
    queryFn: async () => {
      const rows: { trader: string; hbar_amount: number }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("trades")
          .select("trader,hbar_amount")
          .eq("network", NETWORK)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return rows;
    },
    refetchInterval: 60_000,
  });
  const board = pointsLeaderboard(trades.data ?? [], tokens).slice(0, 100);
  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Points leaderboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {POINTS_PER_HBAR} point per HBAR traded · {POINTS_PER_COIN} per coin created · {POINTS_PER_GRADUATION} bonus per coin
            that graduates. Points are counted from on-chain activity and have no cash value.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Wallet</th>
                <th className="p-3 text-right">Volume</th>
                <th className="p-3 text-right">Coins</th>
                <th className="p-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {board.map((r, i) => (
                <tr key={r.wallet} className="border-t border-border">
                  <td className="p-3 font-bold">{i + 1}</td>
                  <td className="p-3"><ProfileLink address={r.wallet}><HederaAddress address={r.wallet} /></ProfileLink></td>
                  <td className="p-3 text-right">{r.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} ℏ</td>
                  <td className="p-3 text-right">{r.coins}</td>
                  <td className="p-3 text-right font-bold text-primary">{r.points.toLocaleString()}</td>
                </tr>
              ))}
              {!trades.isLoading && !board.length && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No points yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
