import { Link } from "@tanstack/react-router";
import {
  type TokenRow,
  fmtHbar,
  fmtAge,
  imageUrl,
  mcapOf,
  progressPct,
} from "@/lib/queries";
import { HederaAddress } from "@/components/HederaAddress";
import { OfficialBadge } from "@/components/OfficialBadge";

export function Progress({ v }: { v: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(v, 100)}%` }} />
    </div>
  );
}

export function TokenImage({ t, className = "h-14 w-14" }: { t: TokenRow; className?: string }) {
  const src = imageUrl(t.image_url);
  return src ? (
    <img
      src={src}
      alt={t.name}
      className={`${className} shrink-0 rounded-md bg-secondary object-cover`}
      loading="lazy"
    />
  ) : (
    <div
      className={`${className} grid shrink-0 place-items-center rounded-md bg-secondary font-display text-lg font-bold text-primary`}
    >
      {t.symbol.slice(0, 2)}
    </div>
  );
}

export function TokenCard({ t }: { t: TokenRow }) {
  const p = progressPct(t);
  return (
    <Link
      to="/token/$id"
      params={{ id: t.address }}
      className="block rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/60"
    >
      <div className="flex gap-3">
        <TokenImage t={t} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold"><span className="truncate">{t.name}</span><OfficialBadge creator={t.creator} /></p>
          <p className="font-mono text-xs text-muted-foreground">
            ${t.symbol} · {fmtAge(t.created_at)} · by <HederaAddress address={t.creator} />
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-xs">
            <span>
              MC <b className="text-primary">{fmtHbar(mcapOf(t))}</b>
            </span>
            <span className="text-muted-foreground">Vol {fmtHbar(Number(t.volume_hbar))}</span>
            <span className="text-muted-foreground">{t.trade_count} trades</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Progress v={p} />
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {t.graduated ? "Graduated" : `${p.toFixed(1)}%`}
        </span>
      </div>
    </Link>
  );
}
