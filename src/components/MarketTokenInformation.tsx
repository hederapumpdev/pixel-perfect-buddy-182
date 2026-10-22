import { queryOptions, useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marketTokenInfo } from "@/lib/market-token-info.functions";
import { formatTokenQuantity } from "@/lib/market-token-info";
import { formatUsd } from "@/lib/markets";
import { HASHSCAN_URL } from "@/lib/hedera-config";

export function MarketTokenInformation({ id, priceUsd }: { id: string; priceUsd: number }) {
  const info = useQuery(queryOptions({ queryKey: ["market-token-info", id], queryFn: () => marketTokenInfo({ data: { id } }), staleTime: 300_000 }));
  const data = info.data;
  const token = data?.token;
  const supply = token ? Number(token.supply) / 10 ** token.decimals : null;
  return <section className="mt-6 border-t border-border pt-5" aria-labelledby="token-information-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="token-information-title" className="text-lg font-semibold">Token information</h2>
      {data && <span className="text-xs text-muted-foreground">Fetched {new Date(data.fetchedAt).toLocaleTimeString()}</span>}
    </div>
    {info.isPending ? <p role="status" className="mt-3 text-sm text-muted-foreground">Loading on-chain information…</p> : <>
      <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
        {[
          ["Current supply", token ? formatTokenQuantity(token.supply, token.decimals) : "Unknown"],
          ["Max supply", token ? token.maxSupply === null ? "Infinite" : formatTokenQuantity(token.maxSupply, token.decimals) : "Unknown"],
          ["Supply valuation", supply !== null && Number.isFinite(supply) ? formatUsd(supply * priceUsd) : "Unknown"],
          ["Positive-balance accounts", data?.holders.count != null ? `${data.holders.count.toLocaleString()}${data.holders.complete ? "" : "+ (partial)"}` : "Unknown"],
          ["Treasury", token?.treasury ?? "Unknown"],
          ["Token status", token ? token.deleted ? "Deleted" : token.paused ? "Paused" : "Active" : "Unknown"],
          ["LP burned", "Unknown"], ["LP locked", "Unknown"],
        ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">Supply valuation is not circulating market cap. LP burn and lock status are unverified; token supply and pool reserves do not prove either.</p>
      <h3 className="mt-5 text-sm font-semibold">Token controls · Hedera Mirror Node</h3>
      {token ? <dl className="mt-2 grid grid-cols-2 gap-x-5 sm:grid-cols-4">{token.controls.map((c) => <div key={c.name} className="flex flex-wrap justify-between gap-1 border-b border-border py-2 text-xs"><dt className="text-muted-foreground">{c.name}</dt><dd>{c.present ? "Key present" : "No key"}</dd></div>)}</dl> : <p className="mt-2 text-sm text-muted-foreground">Unknown</p>}
      <p className="mt-2 text-xs text-muted-foreground">Key presence indicates a control exists, not who can exercise it or whether a token is safe.</p>
      <h3 className="mt-5 text-sm font-semibold">Pools · SaucerSwap V1</h3>
      {data?.pools ? data.pools.length ? <div className="mt-2 divide-y divide-border">{data.pools.map((p) => <div key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
        <div className="min-w-0"><p className="text-sm font-medium">{p.pair}</p><p className="break-all text-xs text-muted-foreground">{p.id}</p><p className="mt-1 break-words text-xs text-muted-foreground">{p.reserveA}<br />{p.reserveB}</p></div>
        <div className="text-right"><p className="text-sm">{p.liquidityUsd === null ? "Value unknown" : formatUsd(p.liquidityUsd)}</p><Button asChild variant="link" size="sm"><a href={`${HASHSCAN_URL}/contract/${p.id}`} target="_blank" rel="noreferrer">Pool <ExternalLink className="size-3" /></a></Button></div>
      </div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No pools returned by this source.</p> : <p className="mt-2 text-sm text-muted-foreground">Pool information unavailable.</p>}
      <h3 className="mt-5 text-sm font-semibold">Top 10 positive balances · Hedera Mirror Node</h3>
      {data?.holders.top.length ? <ol className="mt-2 divide-y divide-border">{data.holders.top.map((h) => <li key={h.account} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><a href={`${HASHSCAN_URL}/account/${h.account}`} target="_blank" rel="noreferrer" className="text-primary">{h.account}</a><span className="break-all">{formatTokenQuantity(h.balance, token?.decimals ?? 0)}</span></li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">Holder information unavailable.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Accounts can include pools, treasury and contracts; these are not unique people.{data?.holders.timestamp ? ` Balance snapshot: ${new Date(Number(data.holders.timestamp) * 1000).toLocaleString()}.` : ""}</p>
    </>}
  </section>;
}