import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Input } from "@/components/ui/input";
import { listMarkets } from "@/lib/markets.functions";
import { imageUrl, tokensQuery } from "@/lib/queries";
import { useChainSync } from "@/hooks/use-sync";
import {
  entityNum,
  formatUsd,
  hbarUsdFrom,
  LOW_LIQUIDITY_USD,
  mergeOwnCoins,
  type MarketToken,
  type OwnCoin,
} from "@/lib/markets";

export const marketsQuery = queryOptions({ queryKey: ["markets"], queryFn: () => listMarkets(), staleTime: 120_000, refetchInterval: 180_000 });

export const Route = createFileRoute("/markets/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Hedera Markets — every SaucerSwap coin | HederaPump" },
      { name: "description", content: "Prices, price change over 1h, 24h or 7d and liquidity for every Hedera token with an HBAR pool on SaucerSwap, plus HederaPump coins still on the bonding curve." },
      { property: "og:title", content: "Hedera Markets — HederaPump" },
      { property: "og:description", content: "Every Hedera coin with an HBAR pool, plus our own launches, in one list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketsQuery),
  component: Markets,
  errorComponent: ({ error }) => <Shell><p role="alert" className="text-destructive">{error instanceof Error ? error.message : String(error)}</p></Shell>,
  notFoundComponent: () => <Shell><p>No markets found.</p></Shell>,
});

const sorts = { liquidity: "Liquidity", newest: "New", gainers: "Gainers", losers: "Losers" } as const;
const frames = { hour: "1h", day: "24h", week: "7d" } as const;
type SortKey = keyof typeof sorts;
type FrameKey = keyof typeof frames;

export function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>;
  return <span className={v >= 0 ? "text-primary" : "text-destructive"}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

function Markets() {
  useChainSync();
  const { data } = useSuspenseQuery(marketsQuery);
  const { data: tokens = [] } = useQuery(tokensQuery);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("liquidity");
  const [frame, setFrame] = useState<FrameKey>("day");
  const own: OwnCoin[] = tokens.map((t) => ({
    address: t.address,
    name: t.name,
    symbol: t.symbol,
    icon: imageUrl(t.image_url),
    graduated: t.graduated,
    virtualHbar: Number(t.virtual_hbar),
    virtualTokens: Number(t.virtual_tokens),
  }));
  const all = mergeOwnCoins(data, own, hbarUsdFrom(data));
  const term = q.trim().toLowerCase();
  const match = (t: MarketToken) => !term || `${t.name} ${t.symbol} ${t.id}`.toLowerCase().includes(term);
  const changeOf = (t: MarketToken) => (frame === "hour" ? t.change1h : frame === "week" ? t.change7d : t.change24h);
  // Our bonding-curve coins get their own block: they have no SaucerSwap pool to rank by.
  const curveRows = all.filter((t) => t.source === "curve" && match(t));
  // Coins without a figure for the chosen period always end up last.
  const key = (t: MarketToken) => changeOf(t) ?? (sort === "gainers" ? -Infinity : Infinity);
  const list = all
    .filter((t) => t.source === "dex" && match(t))
    .sort((a, b) =>
      sort === "liquidity" ? b.liquidityUsd - a.liquidityUsd
      : sort === "newest" ? entityNum(b.id) - entityNum(a.id)
      : sort === "gainers" ? key(b) - key(a)
      : key(a) - key(b));
  const pill = (on: boolean) =>
    `min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
      on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
    }`;
  const head = (k: FrameKey, label: string) => (
    <th className={`p-3 text-right ${frame === k ? "text-primary" : ""}`}>{label}</th>
  );
  const tableHead = (
    <thead className="bg-card text-left text-muted-foreground">
      <tr><th className="p-3">#</th><th className="p-3">Token</th><th className="p-3 text-right">Price</th>{head("hour", "1h")}{head("day", "24h")}{head("week", "7d")}<th className="p-3 text-right">Liquidity</th></tr>
    </thead>
  );
  return (
    <Shell>
      <h1 className="text-3xl font-bold">Hedera Markets</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every token with an HBAR pool on SaucerSwap ({list.length}), plus our {curveRows.length} HederaPump coins
        still on the bonding curve. Not verified by HederaPump — always do your own research.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ticker or 0.0.x" className="h-11 max-w-xs" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sort the list">
          {Object.entries(sorts).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k as SortKey)} className={pill(sort === k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Time frame for gainers and losers">
          {Object.entries(frames).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={frame === k} onClick={() => setFrame(k as FrameKey)} className={pill(frame === k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {curveRows.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-bold">HederaPump coins on the bonding curve</h2>
          <p className="mt-1 text-xs text-muted-foreground">Bought and sold on HederaPump. Graduates to SaucerSwap automatically at 800M tokens sold.</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              {tableHead}
              <tbody>{curveRows.map((t, i) => <Row key={t.id} t={t} i={i} />)}</tbody>
            </table>
          </div>
        </section>
      )}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          {tableHead}
          <tbody>{list.slice(0, 300).map((t, i) => <Row key={t.id} t={t} i={i} />)}</tbody>
        </table>
      </div>
      {list.length > 300 && <p className="mt-2 text-xs text-muted-foreground">Showing top 300 — search to find others.</p>}
    </Shell>
  );
}

function Row({ t, i }: { t: MarketToken; i: number }) {
  const inner = (
    <>
      {t.icon ? <img src={t.icon} alt="" width={24} height={24} loading="lazy" className="size-6 rounded-full" /> : <span className="size-6 rounded-full bg-muted" />}
      <span className="font-semibold">{t.symbol}</span>
      <span className="max-w-40 truncate text-muted-foreground">{t.name}</span>
      {t.source === "curve" && (
        <span className="shrink-0 rounded-full border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Curve</span>
      )}
      {t.source === "dex" && t.liquidityUsd < LOW_LIQUIDITY_USD && <AlertTriangle aria-label="Low liquidity" className="size-4 shrink-0 text-destructive" />}
    </>
  );
  const cls = "flex items-center gap-2";
  const dash = <span className="text-muted-foreground">—</span>;
  return (
    <tr className="border-t border-border hover:bg-card/60">
      <td className="p-3 text-muted-foreground">{i + 1}</td>
      <td className="p-3">
        {t.source === "curve"
          ? <Link to="/token/$id" params={{ id: t.id }} className={cls}>{inner}</Link>
          : <Link to="/markets/$id" params={{ id: t.id }} className={cls}>{inner}</Link>}
      </td>
      <td className="p-3 text-right">{formatUsd(t.priceUsd)}</td>
      <td className="p-3 text-right"><Change v={t.change1h} /></td>
      <td className="p-3 text-right"><Change v={t.change24h} /></td>
      <td className="p-3 text-right"><Change v={t.change7d} /></td>
      <td className="p-3 text-right">{t.source === "curve" ? dash : formatUsd(t.liquidityUsd)}</td>
    </tr>
  );
}
