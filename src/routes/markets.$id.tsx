import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { listMarkets, marketHistory } from "@/lib/markets.functions";
import { formatUsd, LOW_LIQUIDITY_USD } from "@/lib/markets";
import { HASHSCAN_URL, MARKET_ROUTER_ID } from "@/lib/hedera-config";
import { tokensQuery } from "@/lib/queries";
import { marketsQuery, Change } from "./markets.index";

const historyQuery = (id: string) => queryOptions({ queryKey: ["market-history", id], queryFn: () => marketHistory({ data: { id } }), staleTime: 300_000 });

export const Route = createFileRoute("/markets/$id")({
  loader: async ({ context, params }) => {
    const all = await context.queryClient.ensureQueryData(marketsQuery);
    const t = all.find((x) => x.id === params.id);
    if (!t) throw notFound();
    return { name: t.name, symbol: t.symbol };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData ? `${loaderData.symbol} (${loaderData.name}) price — HederaPump Markets` : "Token unavailable — HederaPump Markets";
    const desc = `Price chart, liquidity and 24h change for ${loaderData?.symbol ?? params.id} on Hedera.`;
    return { meta: [
      { title }, { name: "description", content: desc }, { property: "og:title", content: title },
      { property: "og:description", content: desc }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
    ] };
  },
  component: MarketToken,
  errorComponent: ({ error }) => <Shell><p role="alert" className="text-destructive">{error.message}</p></Shell>,
  notFoundComponent: () => <Shell><p>This token has no HBAR pool on SaucerSwap.</p><Link to="/markets" className="text-primary">Back to Markets</Link></Shell>,
});

const evmOf = (id: string) => `0x${BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0")}`;

function MarketToken() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(marketsQuery);
  const t = data.find((x) => x.id === id)!;
  const history = useQuery(historyQuery(id));
  const ours = useQuery(tokensQuery).data?.find((c) => c.address.toLowerCase() === evmOf(id));
  const points = (history.data ?? []).map((p) => ({ ...p, label: new Date(p.t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" }) }));
  const vol24 = (history.data ?? []).slice(-24).reduce((s, p) => s + p.volumeUsd, 0);
  return (
    <Shell>
      <Link to="/markets" className="text-sm text-muted-foreground">← Markets</Link>
      <div className="mt-3 flex items-center gap-3">
        {t.icon && <img src={t.icon} alt="" width={48} height={48} className="size-12 rounded-full" />}
        <div><h1 className="text-2xl font-bold">{t.symbol}</h1><p className="text-sm text-muted-foreground">{t.name} · {t.id}</p></div>
      </div>
      {t.liquidityUsd < LOW_LIQUIDITY_USD && <p className="mt-3 flex items-center gap-2 rounded-md border border-destructive p-3 text-sm text-destructive"><AlertTriangle className="size-4" />Very low liquidity — prices can move a lot and you may not be able to sell.</p>}
      {ours && <p className="mt-3 text-sm">Launched on HederaPump — <Link to="/token/$id" params={{ id: ours.address }} className="text-primary">open coin page</Link></p>}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Price", formatUsd(t.priceUsd)], ["Liquidity", formatUsd(t.liquidityUsd)], ["Volume 24h", history.data ? formatUsd(vol24) : "…"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-semibold">{v}</p></div>
        ))}
        <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">24h</p><p className="font-semibold"><Change v={t.change24h} /></p></div>
      </div>
      <div className="mt-4 h-64 rounded-lg border border-border bg-card p-2">
        {points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points}>
              <XAxis dataKey="label" hide /><YAxis hide domain={["auto", "auto"]} />
              <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Area dataKey="usd" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="p-4 text-sm text-muted-foreground">{history.isLoading ? "Loading chart…" : "No price history yet."}</p>}
      </div>
      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold">Buy / Sell</h2>
        {MARKET_ROUTER_ID ? null : <p className="mt-1 text-sm text-muted-foreground">Trading through HederaPump (1% fee, shown before you confirm) opens soon. Until then you can trade on SaucerSwap.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href={`https://www.saucerswap.finance/swap/HBAR/${t.id}`} target="_blank" rel="noreferrer">SaucerSwap <ExternalLink className="size-4" /></a></Button>
          <Button asChild variant="ghost"><a href={`${HASHSCAN_URL}/token/${t.id}`} target="_blank" rel="noreferrer">HashScan <ExternalLink className="size-4" /></a></Button>
        </div>
      </section>
    </Shell>
  );
}
