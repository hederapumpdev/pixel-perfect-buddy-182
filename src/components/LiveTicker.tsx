import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NETWORK } from "@/lib/hedera-config";
import { tokensQuery } from "@/lib/queries";
import { HederaAddress } from "@/components/HederaAddress";

/** Scrolling bar with the latest real trades (from synced on-chain events). */
export function LiveTicker() {
  const trades = useQuery({
    queryKey: ["ticker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("id, token, trader, is_buy, hbar_amount")
        .eq("network", NETWORK)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });
  const { data: tokens = [] } = useQuery(tokensQuery);
  const sym = new Map(tokens.map((t) => [t.address, t.symbol]));
  const rows = trades.data ?? [];
  if (!rows.length) return null;
  const items = [...rows, ...rows];
  return (
    <div className="overflow-hidden border-b border-border bg-card/60">
      <div className="ticker-track flex w-max gap-8 py-1.5 font-mono text-xs">
        {items.map((r, i) => (
          <Link key={`${r.id}-${i}`} to="/token/$id" params={{ id: r.token }} className="whitespace-nowrap">
            <span className="text-muted-foreground"><HederaAddress address={r.trader} /></span>{" "}
            <span className={r.is_buy ? "text-up" : "text-down"}>{r.is_buy ? "bought" : "sold"}</span>{" "}
            {Number(r.hbar_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ℏ of{" "}
            <span className="font-semibold text-primary">${sym.get(r.token) ?? "?"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
