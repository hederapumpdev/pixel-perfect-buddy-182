import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { RESULT_RANGES, resultSeries, type ResultRange, type ResultTrade } from "@/lib/result-series";
import { fmtHbar } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function ResultChart({ trades }: { trades: ResultTrade[] }) {
  const [range, setRange] = useState<ResultRange>("All");
  const { series, change } = resultSeries(trades, range);
  const up = change >= 0;
  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Trading result (sold minus bought)</p>
          <p className={cn("text-3xl font-bold", up ? "text-up" : "text-down")}>
            {up ? "+" : "−"}
            {fmtHbar(Math.abs(change))}
          </p>
        </div>
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          {(Object.keys(RESULT_RANGES) as ResultRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn("rounded-full px-3 py-1", r === range ? "bg-foreground text-background" : "text-muted-foreground")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line type="stepAfter" dataKey="v" dot={false} strokeWidth={2} stroke={up ? "var(--color-up, hsl(var(--primary)))" : "var(--color-down, hsl(var(--destructive)))"} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">Coins still held are not counted here — see Open for their estimated value.</p>
    </div>
  );
}
