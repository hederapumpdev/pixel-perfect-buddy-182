import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, DemoBadge } from "@/components/Shell";
import { Change, Progress } from "@/components/TokenCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToken, demoTrades, demoChart, fmtHbar, fmtAge } from "@/lib/demo";

export const Route = createFileRoute("/token/$id")({
  loader: ({ params }) => {
    const t = getToken(params.id);
    if (!t) throw notFound();
    return t;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Token"} ($${loaderData?.ticker ?? ""}) — HederaPump` },
      { name: "description", content: `Trade ${loaderData?.name} on HederaPump's bonding curve.` },
      { property: "og:title", content: `${loaderData?.name} — HederaPump` },
      { property: "og:description", content: `Chart, holders and trades for $${loaderData?.ticker}.` },
    ],
  }),
  component: TokenPage,
});

function TokenPage() {
  const t = Route.useLoaderData();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("");
  const pts = demoChart(t);
  const max = Math.max(...pts), min = Math.min(...pts);
  const path = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${100 - ((p - min) / (max - min || 1)) * 90 - 5}`).join(" ");
  const est = Number(amt) > 0 ? (side === "buy" ? (Number(amt) * 0.99) / t.price : Number(amt) * t.price * 0.99) : 0;

  return (
    <Shell>
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-lg bg-secondary text-4xl">{t.emoji}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{t.name}</h1><span className="font-mono text-muted-foreground">${t.ticker}</span><DemoBadge /></div>
          <p className="font-mono text-xs text-muted-foreground">Creator {t.creator} · {fmtAge(t.ageMin)} old</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl font-semibold">{fmtHbar(t.mcap)}</span>
              <span className="text-xs text-muted-foreground">market cap</span>
              <Change v={t.change} />
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-56 w-full">
              <polyline points={path} fill="none" strokeWidth="0.6" vectorEffect="non-scaling-stroke" className={t.change >= 0 ? "stroke-up" : "stroke-down"} style={{ strokeWidth: 2 }} />
            </svg>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <p className="border-b border-border px-4 py-3 text-sm font-semibold">Recent trades</p>
            <div className="divide-y divide-border font-mono text-xs">
              {demoTrades(t).map((r, i) => (
                <div key={i} className="grid grid-cols-4 px-4 py-2">
                  <span className={r.side === "buy" ? "text-up" : "text-down"}>{r.side.toUpperCase()}</span>
                  <span className="truncate text-muted-foreground">{r.account}</span>
                  <span>{r.hbar.toFixed(1)} ℏ</span>
                  <span className="text-right text-muted-foreground">{r.ago} ago</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)} className={`rounded py-2 text-sm font-semibold capitalize ${side === s ? (s === "buy" ? "bg-up text-primary-foreground" : "bg-down text-destructive-foreground") : "text-muted-foreground"}`}>{s}</button>
              ))}
            </div>
            <label className="mt-4 block text-xs text-muted-foreground">Amount ({side === "buy" ? "HBAR" : t.ticker})</label>
            <Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.0" className="mt-1 h-12 font-mono text-lg" />
            <div className="mt-2 flex gap-2">
              {(side === "buy" ? ["10", "50", "100", "500"] : ["25%", "50%", "100%"]).map((v) => (
                <button key={v} onClick={() => setAmt(v.replace("%", ""))} className="flex-1 rounded bg-secondary py-1 font-mono text-xs">{v}</button>
              ))}
            </div>
            <div className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
              <div className="flex justify-between"><span>You receive (est.)</span><span className="text-foreground">{est ? est.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} {side === "buy" ? t.ticker : "ℏ"}</span></div>
              <div className="flex justify-between"><span>Platform fee</span><span>1%</span></div>
              <div className="flex justify-between"><span>Slippage</span><span>2%</span></div>
            </div>
            <Button className="mt-4 h-12 w-full text-base" onClick={() => toast("Trading is disabled in this interface preview. Real Hedera trades come with wallet integration.")}>
              Place {side} order
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between text-sm"><span>Bonding curve</span><span className="font-mono text-primary">{t.progress}%</span></div>
            <div className="mt-2"><Progress v={t.progress} /></div>
            <p className="mt-2 text-xs text-muted-foreground">{t.graduated ? "Graduated — liquidity migrated to a Hedera DEX." : "When the curve fills, liquidity migrates to a Hedera DEX automatically."}</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p className="text-muted-foreground">{t.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
              <span>Holders <b>{t.holders}</b></span><span>Vol <b>{fmtHbar(t.volume)}</b></span>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
