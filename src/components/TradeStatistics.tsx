import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fmtHbar, tradeStatisticsQuery } from "@/lib/queries";
import { tradeStatistics, type TradeWindow } from "@/lib/trade-statistics";
import { useUsd } from "@/lib/usd";

function Comparison({ buy, sell, buyLabel, sellLabel, buyValue, sellValue, buySub, sellSub }: {
  buy: number; sell: number; buyLabel: string; sellLabel: string;
  buyValue: string; sellValue: string; buySub?: string; sellSub?: string;
}) {
  const total = buy + sell;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0"><span className="font-mono text-lg font-semibold text-up">{buyValue}</span><span className="mt-0.5 block text-xs text-muted-foreground">{buyLabel}</span>{buySub && <span className="block font-mono text-xs text-muted-foreground">{buySub}</span>}</div>
        <div className="min-w-0 text-right"><span className="font-mono text-lg font-semibold text-down">{sellValue}</span><span className="mt-0.5 block text-xs text-muted-foreground">{sellLabel}</span>{sellSub && <span className="block font-mono text-xs text-muted-foreground">{sellSub}</span>}</div>
      </div>
      <div className="mt-2 flex h-2 w-full gap-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {buy > 0 && <div className="h-full min-w-1 rounded-full bg-up" style={{ flexGrow: buy / total, flexBasis: 0 }} />}
        {sell > 0 && <div className="h-full min-w-1 rounded-full bg-down" style={{ flexGrow: sell / total, flexBasis: 0 }} />}
      </div>
    </div>
  );
}

export function TradeStatistics({ token }: { token: string }) {
  const [window, setWindow] = useState<TradeWindow>("1h");
  const query = useQuery(tradeStatisticsQuery(token, window));
  const usd = useUsd();
  const stats = query.data ? tradeStatistics(query.data.rows, window, query.data.now) : null;
  return (
    <section aria-label="Trading statistics" className="border-y border-border py-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Statistics</h2>
        <div className="flex shrink-0 gap-1 rounded-md border border-border bg-muted p-1" aria-label="Statistics period">
          {(["5m", "1h", "1d"] as const).map((period) => <Button key={period} size="sm" variant="ghost" aria-pressed={window === period} onClick={() => setWindow(period)} className={window === period ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-muted-foreground"}>{period}</Button>)}
        </div>
      </div>
      {query.isError ? <p role="alert" className="text-sm text-muted-foreground">Statistics unavailable. <Button variant="link" size="sm" onClick={() => query.refetch()}>Try again</Button></p> : !stats ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading statistics…</p> : <div className="space-y-5">
        <Comparison buy={stats.buys.count} sell={stats.sells.count} buyValue={stats.buys.count.toLocaleString()} sellValue={stats.sells.count.toLocaleString()} buyLabel="Buys" sellLabel="Sells" />
        <Comparison buy={stats.buys.volume} sell={stats.sells.volume} buyValue={usd(stats.buys.volume)} sellValue={usd(stats.sells.volume)} buyLabel="Buy volume (USD est.)" sellLabel="Sell volume (USD est.)" buySub={fmtHbar(stats.buys.volume)} sellSub={fmtHbar(stats.sells.volume)} />
        <Comparison buy={stats.buys.wallets} sell={stats.sells.wallets} buyValue={stats.buys.wallets.toLocaleString()} sellValue={stats.sells.wallets.toLocaleString()} buyLabel="Unique buyers" sellLabel="Unique sellers" />
      </div>}
    </section>
  );
}