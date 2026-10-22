import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HASHSCAN_URL, NETWORK } from "@/lib/hedera-config";
import { createSolPool, getSolPoolAdmin } from "@/lib/sol-pool.functions";

const fmt = (v: number, max = 4) => v.toLocaleString(undefined, { maximumFractionDigits: max });

/**
 * Admin: open a SaucerSwap HBAR/SOL pool from the bot wallet.
 * The creation fee and both sides of the liquidity are shown before anything is sent,
 * and the button only works once the bot really holds the SOL and the HBAR.
 */
export function SolPoolPanel({ pin }: { pin: string }) {
  const get = useServerFn(getSolPoolAdmin);
  const create = useServerFn(createSolPool);
  const [sol, setSol] = useState("1");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["sol-pool", pin],
    queryFn: () => get({ data: { pin } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const s = q.data;

  const feeHbar = s ? Number(s.feeTinybars) / 1e8 : 0;
  const amount = Number(sol);
  const hbarSide = s && s.hbarPerSol > 0 && amount > 0 ? amount * s.hbarPerSol : 0;
  const total = hbarSide + feeHbar;
  const usd = total * (s?.hbarUsd ?? 0);
  const missingSol = s ? amount - s.sol : amount;
  const missingHbar = s ? total + 5 - s.hbar : total;
  const ready = !!s && !s.exists && missingSol <= 0 && missingHbar <= 0 && amount > 0;

  async function make() {
    setBusy(true);
    try {
      const r = await create({ data: { pin, sol } });
      toast.success(r.message);
      q.refetch();
    } catch (e) {
      // One attempt per tap: a half-finished pool costs real HBAR, so nothing is resent here.
      toast.error(e instanceof Error ? e.message : "Not created — check the bot wallet history before trying again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Solana pool</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        SOL on Hedera is a token issued by SODAX ({s?.tokenId ?? "0.0.10807298"}), not real Solana SOL.
        Opening an HBAR/SOL pool here lets people buy and sell it on Markets, and lets Solana visitors swap into HBAR.
      </p>

      {q.isError && <p className="mt-3 text-sm text-destructive">Could not read the pool status.</p>}
      {!q.isError && !s && <p className="mt-3 text-sm text-muted-foreground">Reading SaucerSwap…</p>}

      {s && (
        <>
          <p className={`mt-3 text-sm font-medium ${s.exists ? "text-primary" : ""}`}>
            {s.exists ? "This pool already exists — nothing more to do." : "No HBAR/SOL pool exists yet."}
          </p>

          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <div>Pool creation fee: <span className="font-mono">{fmt(feeHbar, 2)} HBAR</span>{s.hbarUsd > 0 && ` (~${fmt(usd > 0 ? feeHbar * s.hbarUsd : 0, 2)} USD)`}</div>
            <div>Price: <span className="font-mono">{fmt(s.hbarPerSol, 1)} HBAR per SOL</span>{s.hbarPerSol <= 0 && " (no live quote)"}</div>
            <div>Bot SOL: <span className="font-mono">{fmt(s.sol, 6)}</span></div>
            <div>Bot HBAR: <span className="font-mono">{fmt(s.hbar, 2)}</span></div>
          </dl>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-muted-foreground">Pool size in SOL</span>
              <Input value={sol} onChange={(e) => setSol(e.target.value)} inputMode="decimal" className="mt-1 w-32" />
            </label>
            <div className="text-sm text-muted-foreground">
              Needs <span className="font-mono">{fmt(hbarSide, 2)} HBAR</span> liquidity +{" "}
              <span className="font-mono">{fmt(feeHbar, 2)} HBAR</span> fee ={" "}
              <span className="font-mono">{fmt(total, 2)} HBAR</span>
              {s.hbarUsd > 0 && <span> (~{fmt(usd, 2)} USD)</span>}
            </div>
          </div>

          {!ready && !s.exists && (
            <p className="mt-3 text-sm text-destructive">
              {missingSol > 0 && `Send ${fmt(missingSol, 6)} SOL to ${s.accountId ?? "the bot wallet"} first. `}
              {missingHbar > 0 && `Top up ${fmt(missingHbar, 2)} HBAR for the liquidity and the creation fee. `}
              Nothing is sent until both are there.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={make} disabled={busy || !ready}>
              {busy ? "Sending…" : "Create pool"}
            </Button>
            <Button variant="outline" asChild>
              <a href={`${HASHSCAN_URL}/token/${s.tokenId}`} target="_blank" rel="noreferrer">SOL on Hedera</a>
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            One tap sends one thing: first the one-time approval, then the pool itself. A pool you fund yourself
            can lose value if SOL moves, and the SOL side is only worth what SODAX honours.
          </p>
        </>
      )}

      {NETWORK !== "mainnet" && <p className="mt-3 text-xs text-muted-foreground">Mainnet only.</p>}
    </section>
  );
}
