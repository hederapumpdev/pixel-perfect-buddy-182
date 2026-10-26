import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHoldersRows, type Trade } from "@/components/CoinExtras";
import { useProfiles } from "@/components/ProfileEditor";
import { layoutBubbles, BUBBLE_VIEW } from "@/lib/bubbles";

const short = (who: string) =>
  who.startsWith("0x") ? `${who.slice(0, 6)}…${who.slice(-4)}` : who;

/** Holder bubble map behind a button — opens a card with one bubble per holder. */
export function BubbleMap({
  tokenId,
  decimals,
  creator,
  contract,
  trades,
  supply,
}: {
  tokenId: string | null;
  decimals: number;
  creator: string;
  contract: string;
  trades: Trade[];
  supply: number;
}) {
  const [open, setOpen] = useState(false);
  const rows = useHoldersRows(open ? tokenId : null, decimals, open ? trades : []);
  const bubbles = useMemo(() => layoutBubbles(rows, supply), [rows, supply]);
  const profiles = useProfiles(open ? rows.map((r) => r.who) : []);
  const cId = contract.toLowerCase();
  const cr = creator.toLowerCase();

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold">Bubble map</p>
          <p className="text-xs text-muted-foreground">
            {open ? `${bubbles.length} holders` : "See who holds this coin"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open && (
        <div className="border-t border-border p-2">
          {bubbles.length ? (
            <svg
              viewBox={`0 0 ${BUBBLE_VIEW.w} ${BUBBLE_VIEW.h}`}
              className="h-auto w-full"
              role="img"
              aria-label="Bubble map of holders"
            >
              {bubbles.map((b) => {
                const w = b.who.toLowerCase();
                const isCurve = w === cId;
                const isDev = w === cr;
                const label = isCurve
                  ? "Bonding curve"
                  : (profiles[w]?.name ?? (isDev ? "dev" : short(b.who)));
                const fill = isCurve
                  ? "fill-primary stroke-primary"
                  : isDev
                    ? "fill-accent/40 stroke-accent"
                    : "fill-primary/15 stroke-primary/50";
                return (
                  <g key={b.who}>
                    <circle cx={b.x} cy={b.y} r={b.r} className={fill} strokeWidth={1.5} />
                    {b.r >= 34 && (
                      <text
                        x={b.x}
                        y={b.y - 2}
                        textAnchor="middle"
                        className="fill-foreground text-[11px] font-semibold"
                        style={{ pointerEvents: "none" }}
                      >
                        {label.length > 14 ? `${label.slice(0, 13)}…` : label}
                      </text>
                    )}
                    {b.r >= 26 && (
                      <text
                        x={b.x}
                        y={b.y + 12}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px]"
                        style={{ pointerEvents: "none" }}
                      >
                        {b.pct.toFixed(2)}%
                      </text>
                    )}
                    <title>{`${label} — ${b.pct.toFixed(2)}% (${b.amt.toLocaleString("en-US", { maximumFractionDigits: 0 })})`}</title>
                  </g>
                );
              })}
            </svg>
          ) : (
            <p className="grid h-40 place-items-center text-sm text-muted-foreground">
              No holders yet.
            </p>
          )}
          <p className="px-2 pb-1 text-center text-xs text-muted-foreground">
            Bubble size represents token balance.
          </p>
        </div>
      )}
    </div>
  );
}
