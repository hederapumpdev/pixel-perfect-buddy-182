import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, DemoBadge } from "@/components/Shell";
import { TokenCard } from "@/components/TokenCard";
import { Input } from "@/components/ui/input";
import { DEMO_TOKENS } from "@/lib/demo";

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

const sorts = { newest: "Newest", mcap: "Market cap", volume: "Volume", holders: "Holders" } as const;

function Explore() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof typeof sorts>("newest");
  const [status, setStatus] = useState<"all" | "curve" | "graduated">("all");
  const list = DEMO_TOKENS.filter((t) => (t.name + t.ticker).toLowerCase().includes(q.toLowerCase()))
    .filter((t) => status === "all" || (status === "graduated" ? t.graduated : !t.graduated))
    .sort((a, b) => sort === "newest" ? a.ageMin - b.ageMin : sort === "mcap" ? b.mcap - a.mcap : sort === "volume" ? b.volume - a.volume : b.holders - a.holders);
  return (
    <Shell>
      <div className="flex items-center gap-2"><h1 className="text-3xl font-bold">Explore</h1><DemoBadge /></div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <Input placeholder="Search name or ticker…" value={q} onChange={(e) => setQ(e.target.value)} className="md:max-w-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>Sort: {v}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All statuses</option><option value="curve">On bonding curve</option><option value="graduated">Graduated</option>
        </select>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => <TokenCard key={t.id} t={t} />)}
        {!list.length && <p className="text-muted-foreground">No tokens match.</p>}
      </div>
    </Shell>
  );
}
