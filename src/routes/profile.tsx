import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { decodeFunctionResult, type Hex } from "viem";
import { Shell } from "@/components/Shell";
import { TokenCard } from "@/components/TokenCard";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { supabase } from "@/integrations/supabase/client";
import { encodePump } from "@/lib/curve";
import artifact from "@/lib/contract-artifact.json";
import { GAS, HASHSCAN_URL, MIRROR_URL, NETWORK, PUMP_CONTRACT_ID } from "@/lib/hedera-config";
import { fmtAge, fmtHbar } from "@/lib/queries";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — HederaPump" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Your coins, trades and creator fees on HederaPump." },
      { property: "og:title", content: "My profile — HederaPump" },
      { property: "og:description", content: "See the coins you launched and claim your fees." },
    ],
  }),
  component: Profile,
});

const longZero = (id: string) =>
  "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

const contractEvm = "0x" + BigInt((PUMP_CONTRACT_ID ?? "0.0.0").split(".")[2]).toString(16).padStart(40, "0");

async function readFees(addr: string): Promise<bigint> {
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: encodePump("creatorFees", [addr]), to: contractEvm, estimate: false }),
  });
  const j = await r.json();
  if (!j.result || j.result === "0x") return 0n;
  return decodeFunctionResult({
    abi: artifact.pumpAbi as never,
    functionName: "creatorFees",
    data: j.result as Hex,
  }) as unknown as bigint;
}

function Profile() {
  const w = useWallet();
  const [busy, setBusy] = useState(false);
  const addrs = w.accountId
    ? [...new Set([longZero(w.accountId), w.evmAddress].filter(Boolean) as string[])]
    : [];

  const coins = useQuery({
    queryKey: ["my-coins", addrs],
    enabled: addrs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("network", NETWORK)
        .in("creator", addrs)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const trades = useQuery({
    queryKey: ["my-trades", addrs],
    enabled: addrs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .in("trader", addrs)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const fees = useQuery({
    queryKey: ["my-fees", addrs],
    enabled: addrs.length > 0 && !!PUMP_CONTRACT_ID,
    queryFn: async () => {
      const all = await Promise.all(addrs.map((a) => readFees(a).catch(() => 0n)));
      return all.reduce((s, v) => s + v, 0n);
    },
    refetchInterval: 15_000,
  });
  const names = new Map((coins.data ?? []).map((c) => [c.address, c.symbol]));

  async function claim() {
    setBusy(true);
    try {
      await w.execute({ calldata: encodePump("claimCreatorFees"), gas: GAS.claim });
      toast.success("Fees claimed — sent to your wallet");
      setTimeout(() => fees.refetch(), 5000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  if (!w.accountId)
    return (
      <Shell>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-3xl font-bold">My profile</h1>
          <p className="mt-2 text-muted-foreground">
            Connect your wallet to see your coins and fees.
          </p>
          <Button className="mt-6" onClick={() => w.connect()}>
            Connect wallet
          </Button>
        </div>
      </Shell>
    );

  const feeHbar = Number(fees.data ?? 0n) / 1e8;
  return (
    <Shell>
      <h1 className="text-3xl font-bold">My profile</h1>
      <p className="mt-1 font-mono text-sm text-muted-foreground">
        <a href={`${HASHSCAN_URL}/account/${w.accountId}`} target="_blank" rel="noreferrer">
          {w.accountId}
        </a>
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Coins created" value={String(coins.data?.length ?? 0)} />
        <Stat label="Your trades" value={String(trades.data?.length ?? 0)} />
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Creator fees to claim</p>
          <p className="mt-1 font-mono text-2xl font-semibold">
            {fees.isLoading ? "…" : fmtHbar(feeHbar)}
          </p>
          <Button
            size="sm"
            className="mt-3 w-full"
            disabled={busy || !(feeHbar > 0)}
            onClick={claim}
          >
            {busy ? "Confirm in your wallet…" : "Claim fees"}
          </Button>
        </div>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Coins you launched</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coins.data?.map((t) => <TokenCard key={t.address} t={t} />)}
        {coins.data && !coins.data.length && (
          <p className="text-muted-foreground">
            None yet.{" "}
            <Link to="/create" className="text-primary">
              Create a coin
            </Link>
          </p>
        )}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Your trades</h2>
      <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card font-mono text-xs">
        {trades.data?.map((r) => (
          <Link
            key={r.id}
            to="/token/$id"
            params={{ id: r.token }}
            className="flex justify-between gap-2 px-4 py-2 hover:bg-muted/40"
          >
            <span className={r.is_buy ? "text-up" : "text-down"}>{r.is_buy ? "BUY" : "SELL"}</span>
            <span>{names.get(r.token) ?? `${r.token.slice(0, 8)}…`}</span>
            <span>{fmtHbar(Number(r.hbar_amount))}</span>
            <span className="text-muted-foreground">{fmtAge(r.created_at)}</span>
          </Link>
        ))}
        {trades.data && !trades.data.length && (
          <p className="px-4 py-3 text-muted-foreground">No trades yet.</p>
        )}
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}
