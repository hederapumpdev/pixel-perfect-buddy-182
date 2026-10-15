import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { TokenCard } from "@/components/TokenCard";
import { Input } from "@/components/ui/input";
import { tokensQuery, mcapOf } from "@/lib/queries";
import { useChainSync } from "@/hooks/use-sync";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore tokens — HederaPump" },
      { name: "description", content: "Search, sort and filter meme coins launched on HederaPump." },
      { property: "og:title", content: "Explore tokens — HederaPump" },
      { property: "og:description", content: "Search, sort and filter Hedera meme coins." },
    ],
  }),
  component: Explore,
});

const sorts = { newest: "Newest", oldest: "Oldest", mcap: "Market cap", volume: "Volume", trades: "Trades" } as const;

function Explore() {
  useChainSync();
  const { data: tokens = [], isLoading } = useQuery(tokensQuery);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof typeof sorts>("newest");
  const [status, setStatus] = useState<"all" | "curve" | "graduated">("all");
  const t0 = (s: string) => new Date(s).getTime();
  const list = tokens
    .filter((t) => (t.name + t.symbol + t.address).toLowerCase().includes(q.toLowerCase()))
    .filter((t) => status === "all" || (status === "graduated" ? t.graduated : !t.graduated))
    .sort((a, b) =>
      sort === "newest" ? t0(b.created_at) - t0(a.created_at)
      : sort === "oldest" ? t0(a.created_at) - t0(b.created_at)
      : sort === "mcap" ? mcapOf(b) - mcapOf(a)
      : sort === "volume" ? Number(b.volume_hbar) - Number(a.volume_hbar)
      : b.trade_count - a.trade_count);
  return (
    <Shell>
      <h1 className="text-3xl font-bold">Explore</h1>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <Input placeholder="Search name, ticker or address…" value={q} onChange={(e) => setQ(e.target.value)} className="md:max-w-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>Sort: {v}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All statuses</option><option value="curve">On bonding curve</option><option value="graduated">Graduated</option>
        </select>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => <TokenCard key={t.address} t={t} />)}
        {!isLoading && !list.length && <p className="text-muted-foreground">No coins match.</p>}
      </div>
    </Shell>
  );
}
