import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Input } from "@/components/ui/input";
import { listMarkets } from "@/lib/markets.functions";
import { formatUsd, LOW_LIQUIDITY_USD, type MarketToken } from "@/lib/markets";

export const marketsQuery = queryOptions({ queryKey: ["markets"], queryFn: () => listMarkets(), staleTime: 120_000, refetchInterval: 180_000 });

export const Route = createFileRoute("/markets/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Hedera Markets — every SaucerSwap coin | HederaPump" },
      { name: "description", content: "Prices, 24h change and liquidity for every Hedera token with an HBAR pool on SaucerSwap." },
      { property: "og:title", content: "Hedera Markets — HederaPump" },
      { property: "og:description", content: "Every Hedera coin with an HBAR pool, in one list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketsQuery),
  component: Markets,
  errorComponent: ({ error }) => <Shell><p role="alert" className="text-destructive">{error.message}</p></Shell>,
  notFoundComponent: () => <Shell><p>No markets found.</p></Shell>,
});

const sorts = { liquidity: "Liquidity", gainers: "24h gainers", losers: "24h losers" } as const;

export function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>;
  return <span className={v >= 0 ? "text-primary" : "text-destructive"}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

function Markets() {
  const { data } = useSuspenseQuery(marketsQuery);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof typeof sorts>("liquidity");
  const term = q.trim().toLowerCase();
  const list = data
    .filter((t) => !term || `${t.name} ${t.symbol} ${t.id}`.toLowerCase().includes(term))
    .sort((a, b) => sort === "liquidity" ? b.liquidityUsd - a.liquidityUsd : ((sort === "gainers" ? 1 : -1) * ((b.change24h ?? -1e9) - (a.change24h ?? -1e9))));
  return (
    <Shell>
      <h1 className="text-3xl font-bold">Hedera Markets</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every token with an HBAR pool on SaucerSwap ({data.length}). Not verified by HederaPump — always do your own research.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ticker or 0.0.x" className="max-w-xs" />
        {Object.entries(sorts).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k as keyof typeof sorts)} className={`rounded-full border px-3 py-1 text-sm ${sort === k ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-muted-foreground">
            <tr><th className="p-3">#</th><th className="p-3">Token</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">1h</th><th className="p-3 text-right">24h</th><th className="p-3 text-right">Liquidity</th></tr>
          </thead>
          <tbody>{list.slice(0, 300).map((t, i) => <Row key={t.id} t={t} i={i} />)}</tbody>
        </table>
      </div>
      {list.length > 300 && <p className="mt-2 text-xs text-muted-foreground">Showing top 300 — search to find others.</p>}
    </Shell>
  );
}

function Row({ t, i }: { t: MarketToken; i: number }) {
  return (
    <tr className="border-t border-border hover:bg-card/60">
      <td className="p-3 text-muted-foreground">{i + 1}</td>
      <td className="p-3">
        <Link to="/markets/$id" params={{ id: t.id }} className="flex items-center gap-2">
          {t.icon ? <img src={t.icon} alt="" width={24} height={24} loading="lazy" className="size-6 rounded-full" /> : <span className="size-6 rounded-full bg-muted" />}
          <span className="font-semibold">{t.symbol}</span>
          <span className="max-w-40 truncate text-muted-foreground">{t.name}</span>
          {t.liquidityUsd < LOW_LIQUIDITY_USD && <AlertTriangle aria-label="Low liquidity" className="size-4 text-destructive" />}
        </Link>
      </td>
      <td className="p-3 text-right">{formatUsd(t.priceUsd)}</td>
      <td className="p-3 text-right"><Change v={t.change1h} /></td>
      <td className="p-3 text-right"><Change v={t.change24h} /></td>
      <td className="p-3 text-right">{formatUsd(t.liquidityUsd)}</td>
    </tr>
  );
}
