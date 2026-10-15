import { Link } from "@tanstack/react-router";
import { type Token, fmtHbar, fmtAge } from "@/lib/demo";

export function Change({ v }: { v: number }) {
  return <span className={`font-mono ${v >= 0 ? "text-up" : "text-down"}`}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

export function Progress({ v }: { v: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(v, 100)}%` }} />
    </div>
  );
}

export function TokenCard({ t }: { t: Token }) {
  return (
    <Link to="/token/$id" params={{ id: t.id }} className="group block rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/60">
      <div className="flex gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-secondary text-3xl">{t.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold">{t.name}</p>
            <Change v={t.change} />
          </div>
          <p className="font-mono text-xs text-muted-foreground">${t.ticker} · {fmtAge(t.ageMin)} · by {t.creator}</p>
          <div className="mt-1 flex gap-3 font-mono text-xs">
            <span>MC <b className="text-primary">{fmtHbar(t.mcap)}</b></span>
            <span className="text-muted-foreground">Vol {fmtHbar(t.volume)}</span>
            <span className="text-muted-foreground">{t.holders} holders</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Progress v={t.progress} />
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{t.graduated ? "Graduated" : `${t.progress}%`}</span>
      </div>
    </Link>
  );
}
