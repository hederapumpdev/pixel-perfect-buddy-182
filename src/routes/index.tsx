import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { About } from "@/components/About";
import { TokenCard } from "@/components/TokenCard";
import { Button } from "@/components/ui/button";
import { tokensQuery, fmtHbar, mcapOf } from "@/lib/queries";
import { useChainSync } from "@/hooks/use-sync";
import { KingOfTheHill } from "@/components/KingOfTheHill";
import banner from "@/assets/banner.png";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "HederaPump — The home of Hedera meme coins" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "description",
        content: "Launch, discover and trade meme coins on Hedera with transparent bonding curves.",
      },
      { property: "og:title", content: "HederaPump — The home of Hedera meme coins" },
      { property: "og:description", content: "Launch, discover and trade meme coins on Hedera." },
    ],
  }),
  component: Index,
});

type Tab = "trending" | "new" | "mcap" | "graduated";

function Index() {
  useChainSync();
  const { data: tokens = [], isLoading } = useQuery(tokensQuery);
  const [tab, setTab] = useState<Tab>("trending");
  const list = [...tokens];
  const shown =
    tab === "trending"
      ? list.sort(
          (a, b) =>
            new Date(b.last_trade_at ?? 0).getTime() - new Date(a.last_trade_at ?? 0).getTime() ||
            Number(b.volume_hbar) - Number(a.volume_hbar),
        )
      : tab === "new"
        ? list
        : tab === "mcap"
          ? list.sort((a, b) => mcapOf(b) - mcapOf(a))
          : list.filter((t) => t.graduated);
  const stats: [string, string | number][] = [
    ["Total volume", fmtHbar(tokens.reduce((s, t) => s + Number(t.volume_hbar), 0))],
    ["Coins launched", tokens.length],
    ["Trades", tokens.reduce((s, t) => s + t.trade_count, 0)],
    ["Graduated", tokens.filter((t) => t.graduated).length],
  ];
  return (
    <Shell>
      <section className="grid-bg rounded-xl border border-border bg-card px-5 py-10 md:px-10 md:py-16">
        <img
          src={banner}
          alt="HederaPump banner"
          width={1600}
          height={512}
          className="mb-8 w-full rounded-lg border border-border"
        />
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Built on Hedera · Paid in ℏ
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[1.05] md:text-6xl">
          The home of Hedera meme coins
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground">
          Launch your token. Trade new ideas. Discover the next community-driven project on Hedera.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" asChild className="glow-primary">
            <Link to="/create">Create Coin</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/explore">Explore Tokens</Link>
          </Button>
        </div>
      </section>

      <KingOfTheHill tokens={tokens} />

      <section className="mt-6">
        <p className="mb-2 text-xs text-muted-foreground">All-time, from on-chain events</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-1 font-mono text-xl font-semibold">{isLoading ? "…" : v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex gap-1 overflow-x-auto">
          {(["trending", "new", "mcap", "graduated"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm capitalize ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {k === "new" ? "New launches" : k === "mcap" ? "Top market cap" : k}
            </button>
          ))}
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading coins…</p>
        ) : shown.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <TokenCard key={t.address} t={t} />
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>

      <About />
    </Shell>
  );
}

export function Empty() {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="font-semibold">No coins yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Be the first to launch one.</p>
      <Button asChild className="mt-4">
        <Link to="/create">Create Coin</Link>
      </Button>
    </div>
  );
}
