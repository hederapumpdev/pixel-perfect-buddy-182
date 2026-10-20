import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, squareImage, toB64 } from "@/components/ProfileEditor";
import { uploadImage } from "@/lib/chain.functions";
import { adminAddStaff, adminListStaff, adminRemoveStaff, adminSetStaffPct, adminUpdateStaff } from "@/lib/staff.functions";
import { STAFF_DEFAULT_PCT, STAFF_MAX_PCT, STAFF_TOTAL_MAX_PCT, staffAllocationAllowed } from "@/lib/staff";
import { fmtHbar } from "@/lib/queries";
import { useUsd } from "@/lib/usd";

function usePhoto() {
  const upload = useServerFn(uploadImage);
  return async (f: File) => {
    const img = await squareImage(f);
    return (await upload({ data: { mime: img.type, base64: await toB64(img) } })).hash;
  };
}

export function StaffPanel({ pin }: { pin: string }) {
  const list = useServerFn(adminListStaff);
  const add = useServerFn(adminAddStaff);
  const update = useServerFn(adminUpdateStaff);
  const remove = useServerFn(adminRemoveStaff);
  const setPct = useServerFn(adminSetStaffPct);
  const photo = usePhoto();
  const usd = useUsd();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["staff-admin"], queryFn: () => list({ data: { pin } }), refetchInterval: 60_000 });
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setNewPct] = useState(String(STAFF_DEFAULT_PCT));
  const [showRemoved, setShowRemoved] = useState(false);
  const active = (q.data ?? []).filter((s) => !s.left_at).length;
  const totalPct = (q.data ?? []).filter((s) => !s.left_at).reduce((a, s) => a + Number(s.share_pct), 0);
  const allocations = (q.data ?? []).filter((s) => !s.left_at).map((s) => Number(s.share_pct));
  const canAdd = pct.trim() !== "" && staffAllocationAllowed(allocations, Number(pct));

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["staff-admin"] });
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["staff-me"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Team</h2>
        <p className="text-sm text-muted-foreground">
          {active} active members · Allocated: {totalPct.toFixed(2)}% / {STAFF_TOTAL_MAX_PCT}% of the platform share · Available: {Math.max(0, STAFF_TOTAL_MAX_PCT - totalPct).toFixed(2)}%. Past earnings stay claimable. Payouts come from the bot wallet.
        </p>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />Show removed members</label>
        {q.isError && <p className="text-sm text-destructive">Could not load team members.</p>}
        {(q.data ?? []).filter((s) => showRemoved || !s.left_at).map((s) => (
          <div key={s.wallet} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
            <label className="cursor-pointer" title="Change photo">
              <Avatar hash={s.avatar} size={44} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) run(async () => update({ data: { pin, wallet: s.wallet, name: s.name, avatar: await photo(f) } }), "Photo updated");
              }} />
            </label>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.name} {s.left_at && <span className="text-xs text-muted-foreground">(stopped)</span>}</p>
              <p className="text-xs text-primary">{Number(s.share_pct)}% of platform share</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{s.account_id ?? s.wallet} · since {new Date(s.joined_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right font-mono text-xs">
              <p>Earned {fmtHbar(s.earned)} <span className="text-muted-foreground">{usd(s.earned)}</span></p>
              <p className="text-muted-foreground">Paid {fmtHbar(s.paid)} · Open {fmtHbar(s.claimable)}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                const n = prompt("New name", s.name);
                if (n) run(() => update({ data: { pin, wallet: s.wallet, name: n, avatar: s.avatar } }), "Name updated");
              }}>Rename</Button>
              {!s.left_at && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                  const v = prompt(`New % of the platform share (0–${STAFF_MAX_PCT})`, String(s.share_pct));
                  if (v !== null) run(() => setPct({ data: { pin, wallet: s.wallet, pct: Number(v.replace(",", ".")) } }), "Percentage updated");
                }}>Change %</Button>
              )}
              {!s.left_at && (
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => {
                  if (confirm(`Remove ${s.name} from the team? Future earnings stop; already-earned funds remain claimable.`))
                    run(() => remove({ data: { pin, wallet: s.wallet } }), "Team member removed");
                }} title={`Remove ${s.name}`} aria-label={`Remove ${s.name}`}><Trash2 className="size-4" />Remove</Button>
              )}
            </div>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No team members yet.</p>}
      </div>
      {(
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await add({ data: { pin, wallet, name, avatar, pct: Number(pct) } });
              setWallet(""); setName(""); setAvatar(null);
            }, "Team member added");
          }}
        >
          <label className="cursor-pointer" title="Photo">
            <Avatar hash={avatar} size={40} />
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) try { setAvatar(await photo(f)); } catch (err) { toast.error((err as Error).message); }
            }} />
          </label>
          <Input className="w-40" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="w-48" placeholder="Wallet (0.0.x)" value={wallet} onChange={(e) => setWallet(e.target.value)} autoCapitalize="off" />
          <label className="space-y-1 text-xs text-muted-foreground">Platform share %<Input aria-label="New member percentage" className="w-28" type="number" min="0" max={STAFF_MAX_PCT} step="0.01" value={pct} onChange={(e) => setNewPct(e.target.value)} /></label>
          <Button type="submit" disabled={busy || !wallet || !name || !canAdd || !q.isSuccess}>Add member</Button>
          {!canAdd && <p className="w-full text-xs text-destructive">Choose a percentage within the remaining 20% team allocation, or lower another member’s percentage first.</p>}
        </form>
      )}
    </section>
  );
}
