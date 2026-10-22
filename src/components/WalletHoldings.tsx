import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TokenImage } from "@/components/TokenCard";
import { encodeToken, isV2 } from "@/lib/curve";
import { MIRROR_URL, NETWORK } from "@/lib/hedera-config";
import { fmtHbar, priceOf } from "@/lib/queries";
import { useHbarUsd, useUsd } from "@/lib/usd";
import { listMarkets } from "@/lib/markets.functions";

const idToEvm = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

async function erc20Balance(token: string, holder: string): Promise<bigint> {
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: encodeToken("balanceOf", [holder]), to: token, estimate: false }),
  });
  const j = await r.json();
  return BigInt(j.result && j.result !== "0x" ? j.result : "0x0");
}

/** HBAR balance + every HederaPump coin the connected wallet holds, read live from Hedera. */
export function WalletHoldings({
  accountId,
  addrs,
  balanceHbar,
}: {
  accountId: string;
  addrs: string[];
  balanceHbar: number | null | undefined;
}) {
  const rate = useHbarUsd().data;
  const usd = useUsd();
  const q = useQuery({
    queryKey: ["holdings", accountId, addrs],
    refetchInterval: 30_000,
    queryFn: async () => {
      const acc = await fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}?transactions=false`).then((r) => r.json());
      const hbar = Number(acc?.balance?.balance ?? 0) / 1e8;
      const hts = new Map<string, number>();
      const raw: { id: string; balance: number }[] = [];
      let next: string | null = `/api/v1/accounts/${accountId}/tokens?limit=100`;
      for (let i = 0; next && i < 5; i++) {
        const j: { tokens?: { token_id: string; balance: number }[]; links?: { next: string | null } } = await fetch(
          MIRROR_URL + next,
        ).then((r) => r.json());
        for (const t of j.tokens ?? []) if (t.balance > 0) {
          hts.set(idToEvm(t.token_id), t.balance / 1e8);
          raw.push({ id: t.token_id, balance: t.balance });
        }
        next = j.links?.next ?? null;
      }
      const { data: traded } = await supabase.from("trades").select("token, is_buy, hbar_amount, token_amount").in("trader", addrs).limit(1000);
      const cand = [...new Set([...hts.keys(), ...(traded ?? []).map((r) => r.token.toLowerCase())])];
      if (!cand.length) return { hbar, rows: [], raw };
      const { data: coins } = await supabase.from("tokens").select("*").eq("network", NETWORK).in("address", cand);
      const rows = await Promise.all(
        (coins ?? []).map(async (c) => {
          let amt = 0;
          if (isV2(c.contract)) amt = hts.get(c.address.toLowerCase()) ?? 0;
          else if (addrs[0]) {
            let b = 0n;
            for (const a of addrs) b += await erc20Balance(c.address, a).catch(() => 0n);
            amt = Number(b) / 1e18;
          }
          let paid = 0,
            got = 0;
          for (const t of traded ?? [])
            if (t.is_buy && t.token.toLowerCase() === c.address.toLowerCase()) {
              paid += Number(t.hbar_amount);
              got += Number(t.token_amount);
            }
          const value = amt * priceOf(c);
          const cost = got > 0 ? (amt * paid) / got : null;
          return { c, amt, value, pnl: cost === null ? null : value - cost, pct: cost ? ((value - cost) / cost) * 100 : null };
        }),
      );
      return { hbar, raw, ours: new Set((coins ?? []).map((c) => c.address.toLowerCase())), rows: rows.filter((r) => r.amt > 0).sort((a, b) => b.value - a.value) };
    },
  });

  // Coins bought elsewhere (SaucerSwap etc.): priced from Markets, sold through our router.
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => listMarkets(), staleTime: 120_000 });
  const others = (q.data?.raw ?? [])
    .filter((t) => !q.data?.ours?.has(idToEvm(t.id)))
    .map((t) => {
      const m = markets.data?.find((x) => x.id === t.id && x.source === "dex");
      return m ? { m, amt: t.balance / 10 ** m.decimals } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => ({ ...x, value: x.amt * x.m.priceHbar }))
    .sort((a, b) => b.value - a.value);
  const hbar = q.data?.hbar ?? balanceHbar ?? 0;
  const total = (q.data?.rows ?? []).reduce((a, r) => a + r.value, 0) + others.reduce((a, r) => a + r.value, 0);
  const pnlAll = (q.data?.rows ?? []).reduce((a, r) => a + (r.pnl ?? 0), 0);
  return (
    <div className="mt-6 rounded-lg border border-border bg-card">
      <div className="grid grid-cols-2 gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs text-muted-foreground">HBAR in your wallet</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{fmtHbar(hbar)}</p>
          {rate && <p className="font-mono text-xs text-muted-foreground">{usd(hbar)}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Your coins are worth</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{q.isLoading ? "…" : fmtHbar(total)}</p>
          {!q.isLoading && rate && <p className="font-mono text-xs text-muted-foreground">{usd(total)}</p>}
          {!q.isLoading && pnlAll !== 0 && (
            <p className={`font-mono text-xs ${pnlAll >= 0 ? "text-up" : "text-down"}`}>
              {pnlAll >= 0 ? "+" : "−"}
              {fmtHbar(Math.abs(pnlAll))}
              {rate && <span> · {usd(Math.abs(pnlAll))}</span>}
            </p>
          )}
        </div>
      </div>
      <p className="px-4 pt-3 text-sm font-semibold">Coins in your wallet</p>
      <div className="divide-y divide-border">
        {(q.data?.rows ?? []).map(({ c, amt, value, pnl, pct }) => (
          <Link
            key={c.address}
            to="/token/$id"
            params={{ id: c.address }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-secondary"
          >
            <TokenImage t={c} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {amt.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${c.symbol}
              </p>
            </div>
            <div className="text-right font-mono">
              <p className="text-sm">
                {fmtHbar(value)}
                {rate && <span className="text-xs text-muted-foreground"> · {usd(value)}</span>}
              </p>
              {pnl !== null && pct !== null && (
                <p className={`text-xs ${pnl >= 0 ? "text-up" : "text-down"}`}>
                  {pnl >= 0 ? "+" : "−"}
                  {fmtHbar(Math.abs(pnl))}
                  {rate && <span> · {usd(Math.abs(pnl))}</span>}{" "}
                  <span className={`ml-1 rounded px-1 ${pnl >= 0 ? "bg-up/15" : "bg-down/15"}`}>
                    {pnl >= 0 ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
                  </span>
                </p>
              )}
            </div>
          </Link>
        ))}
        {!q.isLoading && !q.data?.rows.length && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No HederaPump coins yet.</p>
        )}
      </div>
      {others.length > 0 && (
        <>
          <p className="border-t border-border px-4 pt-3 text-sm font-semibold">Other Hedera coins</p>
          <p className="px-4 text-xs text-muted-foreground">Bought elsewhere — tap one to sell it here.</p>
          <div className="divide-y divide-border">
            {others.map(({ m, amt, value }) => (
              <Link key={m.id} to="/markets/$id" params={{ id: m.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary">
                {m.icon ? (
                  <img src={m.icon} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-bold">{m.symbol.slice(0, 3)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {amt.toLocaleString(undefined, { maximumFractionDigits: amt < 1 ? 4 : 0 })} ${m.symbol}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="text-sm">{fmtHbar(value)}</p>
                  {rate && <p className="text-xs text-muted-foreground">{usd(value)}</p>}
                  <p className="text-xs text-primary">Sell →</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
