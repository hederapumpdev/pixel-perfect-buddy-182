import { Link } from "@tanstack/react-router";
import { ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bondingProgress } from "@/lib/bonding-progress";
import { isV2 } from "@/lib/curve";
import { type TokenRow } from "@/lib/queries";
import { useUsd } from "@/lib/usd";

export function BondingProgress({ token }: { token: TokenRow }) {
  const { percent, remainingHbar } = bondingProgress(token);
  const usd = useUsd();
  return (
    <section aria-label="Bonding curve progress" className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex min-w-0 items-start gap-2 text-base font-semibold tracking-normal">
          <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-up" />
          Bonding curve progress
        </h2>
        <span className="shrink-0 text-xl font-semibold tabular-nums text-up">{percent.toFixed(1)}%</span>
      </div>
      <div role="progressbar" aria-label="Bonding curve" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-up to-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="text-muted-foreground">To graduation (est.)</span>
        <span className="min-w-0 break-words text-right font-semibold tabular-nums text-up">
          {remainingHbar === null ? "Unavailable" : `${remainingHbar.toLocaleString("en-US", { maximumFractionDigits: 2 })} HBAR (${usd(remainingHbar)})`}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
        <Zap aria-hidden="true" className="mr-1 size-5 shrink-0 fill-primary text-primary" />
        <span className="text-muted-foreground">{token.graduated ? "Graduated · curve closed." : "Graduates at 100%."}</span>
        <Button variant="link" asChild className="h-auto p-0 text-sm text-up"><Link to="/how-it-works">How it works<ChevronRight /></Link></Button>
      </div>
      {token.graduated && <p className="mt-2 text-xs text-muted-foreground">{isV2(token.contract) ? "Liquidity moved to SaucerSwap." : "DEX listing pending."}</p>}
    </section>
  );
}