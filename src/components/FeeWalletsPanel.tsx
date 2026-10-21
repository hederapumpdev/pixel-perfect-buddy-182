import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getFundWalletsAdmin } from "@/lib/holdout.functions";
import { encodePump } from "@/lib/curve";
import { GAS, HASHSCAN_URL } from "@/lib/hedera-config";
import { fmtHbar } from "@/lib/queries";
import { useWallet } from "@/lib/wallet";

const LABEL: Record<string, string> = { split: "Bot wallet (receives all platform fees)", team: "Team wallet (pays staff)", holdout: "Hold Out wallet (holder rewards + contest prize)" };
const hb = (t: string | number) => fmtHbar(Number(t) / 1e8);

/** Admin: balances of the three fee wallets and the owner action that points contracts at the split wallet. */
export function FeeWalletsPanel({ pin }: { pin: string }) {
  const get = useServerFn(getFundWalletsAdmin);
  const q = useQuery({ queryKey: ["fund-wallets", pin], queryFn: () => get({ data: { pin } }), refetchInterval: 30_000 });
  const w = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const split = q.data?.wallets.find((x) => x.name === "split");

  // One wallet request per tap; never retried automatically.
  async function point(contract: string) {
    if (!split?.accountId) return;
    if (!w.accountId) { await w.connect().catch(() => {}); return; }
    setBusy(contract);
    try {
      await w.execute({ calldata: encodePump("setFeeRecipient", [split.address]), gas: GAS.claim, contractId: contract });
      toast.success(`Contract ${contract} now sends fees to the bot wallet`);
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Not changed — check your wallet history before trying again");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Fee wallets</h2>
      <p className="text-sm text-muted-foreground">
        All platform fees go to the bot wallet, which forwards only the fee money every hour: 2/7 team, 1/7 Hold Out, 4/7 platform wallet. Its own buy budget is never forwarded.
      </p>
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {(q.data?.wallets ?? []).map((x) => (
          <div key={x.name} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{LABEL[x.name]}</p>
            <p className="mt-1 font-mono text-xl font-semibold">{fmtHbar(x.hbar)}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{x.accountId ?? "Not created yet — the hourly job funds it from the bot"}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-2">Contract</th><th className="p-2">Fees go to</th><th className="p-2">Unclaimed</th><th className="p-2" /></tr></thead>
          <tbody>
            {(q.data?.contracts ?? []).map((c) => {
              const done = !!split && c.feeRecipient?.toLowerCase() === split.address;
              return (
                <tr key={c.contract} className="border-t border-border">
                  <td className="p-2 font-mono">{c.contract}</td>
                  <td className="p-2 font-mono text-xs">{done ? "Split wallet ✓" : c.feeRecipient ?? "?"}</td>
                  <td className="p-2 font-mono">{hb(c.platformFees)}</td>
                  <td className="p-2 text-right">
                    {!done && (
                      <Button size="sm" disabled={!split?.accountId || busy !== null} onClick={() => point(c.contract)}>
                        {busy === c.contract ? "Confirm in wallet…" : "Send fees to bot wallet"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Only the contract owner wallet can approve this change.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="font-semibold">Recent transfers</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {(q.data?.transfers ?? []).map((t: { id: string; tinybars: string | number; status: string; tx_hash: string | null }) => (
              <li key={t.id} className="flex justify-between gap-2"><span className="font-mono">{t.id}</span><span>{hb(t.tinybars)} {t.tx_hash ? <a className="text-primary" href={`${HASHSCAN_URL}/transaction/${t.tx_hash}`} target="_blank" rel="noreferrer">{t.status}</a> : t.status}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Hold Out + staff payouts</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {(q.data?.payouts ?? []).map((p: { id: string; tinybars: string | number; status: string }) => (
              <li key={p.id} className="flex justify-between gap-2"><span className="font-mono">{p.id}</span><span>{hb(p.tinybars)} {p.status}</span></li>
            ))}
            {(q.data?.staff ?? []).map((p: { id: string; hbar_amount: number; status: string }) => (
              <li key={p.id} className="flex justify-between gap-2"><span className="font-mono">{p.id}</span><span>{fmtHbar(Number(p.hbar_amount))} {p.status}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Hold Out weeks</h3>
        <div className="mt-1 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground"><tr><th className="p-2">Week</th><th className="p-2">Status</th><th className="p-2">Pot</th><th className="p-2">Paid out</th><th className="p-2">Carried over</th><th className="p-2">Coins</th><th className="p-2">Snapshots</th></tr></thead>
            <tbody>
              {(q.data?.periods ?? []).map((p: { period: string; status: string; pot_tinybars: number; planned_tinybars: number; residual_tinybars: number; coinCount: number }) => (
                <tr key={p.period} className="border-t border-border">
                  <td className="p-2 font-mono">{p.period}</td><td className="p-2">{p.status}</td>
                  <td className="p-2 font-mono">{hb(p.pot_tinybars)}</td><td className="p-2 font-mono">{hb(p.planned_tinybars)}</td>
                  <td className="p-2 font-mono">{hb(p.residual_tinybars)}</td><td className="p-2">{p.coinCount}</td>
                  <td className="p-2">{q.data?.snapshots?.[p.period]?.slots ?? 0}/4</td>
                </tr>
              ))}
              {Object.entries(q.data?.snapshots ?? {}).filter(([k]) => !(q.data?.periods ?? []).some((p: { period: string }) => p.period === k)).map(([k, v]) => (
                <tr key={k} className="border-t border-border"><td className="p-2 font-mono">{k}</td><td className="p-2">collecting</td><td className="p-2" colSpan={4}>—</td><td className="p-2">{v.slots}/4</td></tr>
              ))}
              {!(q.data?.periods ?? []).length && !Object.keys(q.data?.snapshots ?? {}).length && (
                <tr><td className="p-2 text-muted-foreground" colSpan={7}>No Hold Out week yet — counting starts Monday 26 October.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
