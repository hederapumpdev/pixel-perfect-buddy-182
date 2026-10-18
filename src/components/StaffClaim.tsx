import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimStaff, getStaffBalance } from "@/lib/staff.functions";
import { STAFF_MIN_CLAIM_HBAR } from "@/lib/staff";
import { fmtHbar } from "@/lib/queries";
import { useUsd } from "@/lib/usd";

/** Shown on the profile only when the connected wallet is a team member. */
export function StaffClaim({ wallets }: { wallets: string[] }) {
  const get = useServerFn(getStaffBalance);
  const claim = useServerFn(claimStaff);
  const usd = useUsd();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["staff-me", wallets], queryFn: () => get({ data: { wallets } }), refetchInterval: 30_000 });
  const s = q.data;
  if (!s) return null;
  return (
    <div className="mt-6 rounded-lg border border-primary/40 bg-card p-4">
      <h2 className="text-xl font-semibold">Team earnings</h2>
      <p className="text-sm text-muted-foreground">5% of the platform fee share on all trading since {new Date(s.joined_at).toLocaleDateString()}.</p>
      <div className="mt-3 grid grid-cols-3 gap-3 font-mono">
        <div><p className="text-xs text-muted-foreground">Earned</p><p className="font-semibold">{fmtHbar(s.earned)}</p><p className="text-xs text-muted-foreground">{usd(s.earned)}</p></div>
        <div><p className="text-xs text-muted-foreground">Claimed</p><p className="font-semibold">{fmtHbar(s.paid)}</p></div>
        <div><p className="text-xs text-muted-foreground">To claim</p><p className="font-semibold">{fmtHbar(s.claimable)}</p><p className="text-xs text-muted-foreground">{usd(s.claimable)}</p></div>
      </div>
      <Button
        className="mt-3 w-full"
        disabled={busy || s.claimable < STAFF_MIN_CLAIM_HBAR}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await claim({ data: { wallet: s.wallet } });
            toast.success(`${fmtHbar(r.hbar)} is on its way to your wallet`);
            q.refetch();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending…" : s.claimable < STAFF_MIN_CLAIM_HBAR ? `Claim from ${STAFF_MIN_CLAIM_HBAR} HBAR` : "Claim"}
      </Button>
    </div>
  );
}
