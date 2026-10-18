import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, squareImage, toB64 } from "@/components/ProfileEditor";
import { uploadImage } from "@/lib/chain.functions";
import { adminAddStaff, adminListStaff, adminRemoveStaff, adminUpdateStaff } from "@/lib/staff.functions";
import { STAFF_MAX } from "@/lib/staff";
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
  const photo = usePhoto();
  const usd = useUsd();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["staff-admin"], queryFn: () => list({ data: { pin } }), refetchInterval: 60_000 });
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = (q.data ?? []).filter((s) => !s.left_at).length;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["staff-admin"] });
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
          Each member earns 5% of the platform fee share on all trading since they joined, and claims it from their profile. Payouts come from the bot wallet — keep it topped up.
        </p>
      </div>
      <div className="space-y-2">
        {(q.data ?? []).map((s) => (
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
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => {
                  if (confirm(`Stop earnings for ${s.name}? What they earned stays claimable.`))
                    run(() => remove({ data: { pin, wallet: s.wallet } }), "Stopped");
                }}>Stop</Button>
              )}
            </div>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No team members yet.</p>}
      </div>
      {active < STAFF_MAX && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await add({ data: { pin, wallet, name, avatar } });
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
          <Button type="submit" disabled={busy || !wallet || !name}>Add ({active}/{STAFF_MAX})</Button>
        </form>
      )}
    </section>
  );
}
