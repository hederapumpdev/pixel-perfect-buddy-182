import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, DemoBadge } from "@/components/Shell";
import { TokenCard } from "@/components/TokenCard";
import { Button } from "@/components/ui/button";
import { DEMO_TOKENS, fmtHbar } from "@/lib/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HederaPump — The home of Hedera meme coins" },
      { name: "description", content: "Launch, discover and trade meme coins on Hedera with transparent bonding curves." },
      { property: "og:title", content: "HederaPump — The home of Hedera meme coins" },
      { property: "og:description", content: "Launch, discover and trade meme coins on Hedera." },
    ],
  }),
  component: Index,
});

function Index() {
  const [tab, setTab] = useState<"trending" | "new" | "gainers" | "graduated">("trending");
  const list = [...DEMO_TOKENS];
  const shown =
    tab === "trending" ? list.sort((a, b) => b.volume - a.volume)
    : tab === "new" ? list.sort((a, b) => a.ageMin - b.ageMin)
    : tab === "gainers" ? list.sort((a, b) => b.change - a.change)
    : list.filter((t) => t.graduated);
  const stats = [
    ["Volume (24h)", fmtHbar(DEMO_TOKENS.reduce((s, t) => s + t.volume, 0))],
    ["Tokens launched", DEMO_TOKENS.length],
    ["Trades (24h)", "1,284"],
    ["Graduated", DEMO_TOKENS.filter((t) => t.graduated).length],
  ];
  return (
    <Shell>
      <section className="grid-bg relative overflow-hidden rounded-xl border border-border bg-card px-5 py-10 md:px-10 md:py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Built on Hedera · Paid in ℏ</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[1.05] md:text-6xl">The home of Hedera meme coins</h1>
        <p className="mt-4 max-w-lg text-muted-foreground">Launch your token. Trade new ideas. Discover the next community-driven project on Hedera.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" asChild className="glow-primary"><Link to="/create">Create Coin</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/explore">Explore Tokens</Link></Button>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">Platform overview <DemoBadge /></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-1 font-mono text-xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex gap-1 overflow-x-auto">
          {(["trending", "new", "gainers", "graduated"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {k === "new" ? "New launches" : k === "gainers" ? "Top gainers" : k}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => <TokenCard key={t.id} t={t} />)}
        </div>
      </section>
    </Shell>
  );
}
