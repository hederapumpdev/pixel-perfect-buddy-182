import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { fmtHbar, imageUrl, mcapOf, progressPct, type TokenRow } from "@/lib/queries";

/** The non-graduated coin closest to graduation. */
export function KingOfTheHill({ tokens }: { tokens: TokenRow[] }) {
  const king = tokens
    .filter((t) => !t.graduated && Number(t.tokens_sold) > 0)
    .sort((a, b) => progressPct(b) - progressPct(a))[0];
  if (!king) return null;
  const pct = progressPct(king);
  const img = imageUrl(king.image_url);
  return (
    <Link
      to="/token/$id"
      params={{ id: king.address }}
      className="mt-6 flex items-center gap-4 rounded-xl border border-primary/40 bg-card p-4 glow-primary"
    >
      {img ? (
        <img src={img} alt={king.name} className="h-20 w-20 rounded-lg object-cover" />
      ) : (
        <div className="h-20 w-20 rounded-lg bg-secondary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-primary">
          <Crown className="h-4 w-4" /> King of the Hill
        </p>
        <p className="mt-1 truncate text-lg font-bold">
          {king.name} <span className="text-muted-foreground">${king.symbol}</span>
        </p>
        <p className="text-xs text-muted-foreground">Market cap {fmtHbar(mcapOf(king))}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{pct.toFixed(1)}% to graduation</p>
      </div>
    </Link>
  );
}
