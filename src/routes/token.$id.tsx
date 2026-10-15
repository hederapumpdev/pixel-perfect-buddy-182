import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { encodeFunctionData } from "viem";
import { Shell } from "@/components/Shell";
import { Progress, TokenImage } from "@/components/TokenCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet";
import { useChainSync } from "@/hooks/use-sync";
import { tokenQuery, tradesQuery, fmtHbar, fmtAge, mcapOf, priceOf, progressPct, shortAddr } from "@/lib/queries";
import { quoteBuy, quoteSell, toTinybars, toUnits, fromTinybars, fromUnits } from "@/lib/curve";
import { GAS, HASHSCAN_URL, MIRROR_URL, TOKEN_UNIT } from "@/lib/hedera-config";
import artifact from "@/lib/contract-artifact.json";

export const Route = createFileRoute("/token/$id")({
  head: () => ({
    meta: [
      { title: "Coin — HederaPump" },
      { name: "description", content: "Chart, trades and bonding-curve progress for a HederaPump coin." },
      { property: "og:title", content: "Coin — HederaPump" },
      { property: "og:description", content: "Trade this coin on HederaPump." },
    ],
  }),
  component: TokenPage,
});

async function tokenBalance(token: string, holder: string): Promise<bigint> {
  const data = encodeFunctionData({ abi: artifact.tokenAbi as never, functionName: "balanceOf", args: [holder] });
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, to: token, estimate: false }) });
  const j = await r.json();
  return BigInt(j.result && j.result !== "0x" ? j.result : "0x0");
}

const SLIPPAGE_BPS = 300n;

function TokenPage() {
  const { id } = Route.useParams();
  const sync = useChainSync(8000);
  const w = useWallet();
  const { data: t, isLoading } = useQuery(tokenQuery(id));
  const { data: trades = [] } = useQuery(tradesQuery(id));
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [bal, setBal] = useState<bigint>(0n);

  useEffect(() => {
    if (!w.evmAddress) return setBal(0n);
    tokenBalance(id, w.evmAddress).then(setBal).catch(() => setBal(0n));
  }, [id, w.evmAddress, trades.length]);

  if (isLoading) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  if (!t) return <Shell><p>Coin not found yet. If it was just launched, give it a few seconds.</p><Link to="/explore" className="text-primary">Back to explore</Link></Shell>;

  const state = { virtualHbar: BigInt(Math.round(Number(t.virtual_hbar) * 1e8)), virtualTokens: BigInt(Math.round(Number(t.virtual_tokens))) * TOKEN_UNIT, tokensSold: BigInt(Math.round(Number(t.tokens_sold))) * TOKEN_UNIT };
  const ready = state.virtualHbar > 0n;
  let est = "—";
  try {
    if (ready && Number(amt) > 0) est = side === "buy"
      ? `${fromUnits(quoteBuy(state, toTinybars(amt)).tokensOut).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.symbol}`
      : `${fromTinybars(quoteSell(state, toUnits(amt)).hbarOut).toFixed(4)} ℏ`;
  } catch { /* bad input */ }

  async function trade() {
    if (!w.accountId) return w.connect();
    if (!t || !(Number(amt) > 0)) return;
    setBusy(true);
    try {
      if (side === "buy") {
        const value = toTinybars(amt);
        const min = ready ? (quoteBuy(state, value).tokensOut * (10_000n - SLIPPAGE_BPS)) / 10_000n : 0n;
        await w.execute({ calldata: encodeFunctionData({ abi: artifact.pumpAbi as never, functionName: "buy", args: [t.address, min] }), gas: GAS.buy, payableTinybars: value });
      } else {
        const units = toUnits(amt);
        if (units > bal) throw new Error("You don't hold that many");
        const min = (quoteSell(state, units).hbarOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
        await w.execute({ calldata: encodeFunctionData({ abi: artifact.pumpAbi as never, functionName: "sell", args: [t.address, units, min] }), gas: GAS.sell });
      }
      toast.success(`${side === "buy" ? "Bought" : "Sold"} — confirmed on Hedera`);
      setAmt("");
      setTimeout(() => sync().catch(() => {}), 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally { setBusy(false); }
  }

  const pts = [...trades].reverse().map((r) => Number(r.price));
  const max = Math.max(...pts, 0), min = Math.min(...pts, max);
  const path = pts.length > 1 ? pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${95 - ((p - min) / (max - min || 1)) * 90}`).join(" ") : "";
  const p = progressPct(t);

  return (
    <Shell>
      <div className="flex items-start gap-4">
        <TokenImage t={t} className="h-16 w-16" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{t.name}</h1><span className="font-mono text-muted-foreground">${t.symbol}</span></div>
          <p className="font-mono text-xs text-muted-foreground">
            Creator {shortAddr(t.creator)} · {fmtAge(t.created_at)} old · <a className="text-accent" href={`${HASHSCAN_URL}/contract/${t.address}`} target="_blank" rel="noreferrer">{shortAddr(t.address)}</a>
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <aside className="order-first space-y-4 lg:order-last lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4">
            {t.graduated ? <p className="text-sm">This coin has graduated. Curve trading is closed; liquidity moves to a Hedera DEX.</p> : <>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                {(["buy", "sell"] as const).map((s) => (
                  <button key={s} onClick={() => { setSide(s); setAmt(""); }} className={`rounded py-2 text-sm font-semibold capitalize ${side === s ? (s === "buy" ? "bg-up text-primary-foreground" : "bg-down text-destructive-foreground") : "text-muted-foreground"}`}>{s}</button>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                <span>Amount ({side === "buy" ? "HBAR" : t.symbol})</span>
                {w.accountId && <span className="font-mono">{side === "buy" ? `${w.balanceHbar?.toFixed(2) ?? "—"} ℏ` : `${fromUnits(bal).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.symbol}`}</span>}
              </div>
              <Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" className="mt-1 h-12 font-mono text-lg" />
              <div className="mt-2 flex gap-2">
                {side === "buy"
                  ? ["10", "50", "100", "500"].map((v) => <button key={v} onClick={() => setAmt(v)} className="flex-1 rounded bg-secondary py-1 font-mono text-xs">{v} ℏ</button>)
                  : [25n, 50n, 100n].map((pc) => <button key={String(pc)} onClick={() => setAmt(String(fromUnits((bal * pc) / 100n)))} className="flex-1 rounded bg-secondary py-1 font-mono text-xs">{String(pc)}%</button>)}
              </div>
              <div className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between"><span>You receive (est.)</span><span className="text-foreground">{est}</span></div>
                <div className="flex justify-between"><span>Fee</span><span>1%</span></div>
                <div className="flex justify-between"><span>Max slippage</span><span>3%</span></div>
              </div>
              <Button className="mt-4 h-12 w-full text-base" disabled={busy || (!!w.accountId && !(Number(amt) > 0))} onClick={trade}>
                {busy ? "Confirm in wallet…" : w.accountId ? `${side === "buy" ? "Buy" : "Sell"} ${t.symbol}` : "Connect wallet"}
              </Button>
            </>}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between text-sm"><span>Bonding curve</span><span className="font-mono text-primary">{p.toFixed(1)}%</span></div>
            <div className="mt-2"><Progress v={p} /></div>
            <p className="mt-2 text-xs text-muted-foreground">{t.graduated ? "Graduated." : "When 800M tokens are sold, the coin graduates and liquidity moves to a Hedera DEX."}</p>
          </div>
          {(t.description || t.website || t.twitter || t.telegram) && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
              {t.description && <p className="text-muted-foreground">{t.description}</p>}
              <div className="flex flex-wrap gap-3 text-xs">
                {t.website && /^https?:\/\//.test(t.website) && <a className="text-accent" href={t.website} target="_blank" rel="noreferrer nofollow">Website</a>}
                {t.twitter && <span className="text-muted-foreground">X: {t.twitter}</span>}
                {t.telegram && <span className="text-muted-foreground">TG: {t.telegram}</span>}
              </div>
            </div>
          )}
        </aside>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-2xl font-semibold">{fmtHbar(mcapOf(t))}</span>
              <span className="text-xs text-muted-foreground">market cap · price {priceOf(t).toPrecision(3)} ℏ · vol {fmtHbar(Number(t.volume_hbar))}</span>
            </div>
            {path ? (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-56 w-full">
                <polyline points={path} fill="none" vectorEffect="non-scaling-stroke" className="stroke-up" style={{ strokeWidth: 2 }} />
              </svg>
            ) : <p className="mt-4 grid h-56 place-items-center text-sm text-muted-foreground">Chart appears after the first trades.</p>}
          </div>

          <div className="rounded-lg border border-border bg-card">
            <p className="border-b border-border px-4 py-3 text-sm font-semibold">Trades</p>
            <div className="divide-y divide-border font-mono text-xs">
              {trades.slice(0, 50).map((r) => (
                <a key={r.id} href={`${HASHSCAN_URL}/transaction/${r.tx_hash}`} target="_blank" rel="noreferrer" className="grid grid-cols-4 px-4 py-2 hover:bg-secondary">
                  <span className={r.is_buy ? "text-up" : "text-down"}>{r.is_buy ? "BUY" : "SELL"}</span>
                  <span className="truncate text-muted-foreground">{shortAddr(r.trader)}</span>
                  <span>{Number(r.hbar_amount).toFixed(2)} ℏ</span>
                  <span className="text-right text-muted-foreground">{fmtAge(r.created_at)} ago</span>
                </a>
              ))}
              {!trades.length && <p className="px-4 py-6 text-center text-muted-foreground">No trades yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
