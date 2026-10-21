import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHoldoutEstimate } from "@/lib/holdout.functions";
import { HASHSCAN_URL } from "@/lib/hedera-config";
import { fmtHbar } from "@/lib/queries";

const hbar = (t: string | number) => fmtHbar(Number(t) / 1e8);

/** Estimated Hold Out reward this week + payout history for one wallet. */
export function HoldOutCard({ wallet, compact }: { wallet: string; compact?: boolean }) {
  const est = useServerFn(getHoldoutEstimate);
  const q = useQuery({ queryKey: ["holdout-est", wallet], queryFn: () => est({ data: { wallet } }), enabled: !!wallet });
  const history = q.data?.history ?? [];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Hold Out</h2>
        {compact && <Link to="/holdout" className="text-sm text-primary hover:underline">How it works</Link>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Estimated reward this week for holding coins 7+ days. Estimates change until the week ends; nothing is guaranteed.
      </p>
      <p className="mt-3 font-mono text-2xl font-semibold">{q.isLoading ? "…" : hbar(q.data?.estimate ?? "0")}</p>
      {(() => {
        const paid = history.find((h: { status: string; tinybars: string | number }) => h.status === "done" && Number(h.tinybars) > 0) as { period: string; tinybars: string | number } | undefined;
        if (!paid) return null;
        const text = `I just earned ${hbar(paid.tinybars)} from Hold Out on @HederaPump for holding my coins 💎 Hold longer, earn more:`;
        const url = "https://hederapump.dev/holdout";
        return (
          <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
            <p>🎉 You received {hbar(paid.tinybars)} for the week of {paid.period}. Share it!</p>
            <div className="mt-2 flex gap-3">
              <a className="font-medium text-primary hover:underline" target="_blank" rel="noreferrer" href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}>Share on X</a>
              <a className="font-medium text-primary hover:underline" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}>Share on Telegram</a>
            </div>
          </div>
        );
      })()}
      {history.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {history.slice(0, compact ? 3 : 20).map((h: { period: string; tinybars: string | number; status: string; tx_hash: string | null }) => (
            <li key={h.period} className="flex justify-between gap-2">
              <span className="text-muted-foreground">Week of {h.period}</span>
              <span className="font-mono">
                {hbar(h.tinybars)}{" "}
                {h.tx_hash ? (
                  <a className="text-primary hover:underline" href={`${HASHSCAN_URL}/transaction/${h.tx_hash}`} target="_blank" rel="noreferrer">{h.status}</a>
                ) : (
                  <span className="text-muted-foreground">{h.status}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
