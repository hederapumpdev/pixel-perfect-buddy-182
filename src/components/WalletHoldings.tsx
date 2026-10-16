import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TokenImage } from "@/components/TokenCard";
import { encodeToken, isV2 } from "@/lib/curve";
import { MIRROR_URL, NETWORK } from "@/lib/hedera-config";
import { fmtHbar, priceOf } from "@/lib/queries";

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
  const q = useQuery({
    queryKey: ["holdings", accountId, addrs],
    refetchInterval: 30_000,
    queryFn: async () => {
      const acc = await fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}?transactions=false`).then((r) => r.json());
      const hbar = Number(acc?.balance?.balance ?? 0) / 1e8;
      const hts = new Map<string, number>();
      let next: string | null = `/api/v1/accounts/${accountId}/tokens?limit=100`;
      for (let i = 0; next && i < 5; i++) {
        const j: { tokens?: { token_id: string; balance: number }[]; links?: { next: string | null } } = await fetch(
          MIRROR_URL + next,
        ).then((r) => r.json());
        for (const t of j.tokens ?? []) if (t.balance > 0) hts.set(idToEvm(t.token_id), t.balance / 1e8);
        next = j.links?.next ?? null;
      }
      const { data: traded } = await supabase.from("trades").select("token").in("trader", addrs).limit(1000);
      const cand = [...new Set([...hts.keys(), ...(traded ?? []).map((r) => r.token.toLowerCase())])];
      if (!cand.length) return { hbar, rows: [] };
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
          return { c, amt, value: amt * priceOf(c) };
        }),
      );
      return { hbar, rows: rows.filter((r) => r.amt > 0).sort((a, b) => b.value - a.value) };
    },
  });

  const hbar = q.data?.hbar ?? balanceHbar ?? 0;
  const total = (q.data?.rows ?? []).reduce((a, r) => a + r.value, 0);
  return (
    <div className="mt-6 rounded-lg border border-border bg-card">
      <div className="grid grid-cols-2 gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs text-muted-foreground">HBAR in your wallet</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{fmtHbar(hbar)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Your coins are worth</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{q.isLoading ? "…" : fmtHbar(total)}</p>
        </div>
      </div>
      <p className="px-4 pt-3 text-sm font-semibold">Coins in your wallet</p>
      <div className="divide-y divide-border">
        {(q.data?.rows ?? []).map(({ c, amt, value }) => (
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
            <span className="font-mono text-sm">{fmtHbar(value)}</span>
          </Link>
        ))}
        {!q.isLoading && !q.data?.rows.length && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No HederaPump coins yet.</p>
        )}
      </div>
    </div>
  );
}
