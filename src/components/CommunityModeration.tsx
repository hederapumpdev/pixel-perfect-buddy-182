import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Ban, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, useProfiles } from "./ProfileEditor";
import { HederaAddress } from "./HederaAddress";
import { getCommunityModeration, moderateCommunity } from "@/lib/community.functions";

export function CommunityModeration({ pin }: { pin: string }) {
  const list = useServerFn(getCommunityModeration);
  const moderate = useServerFn(moderateCommunity);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["community-moderation", pin], queryFn: () => list({ data: { pin } }), refetchInterval: 15_000 });
  const profiles = useProfiles(q.data?.messages.map(m => m.author) ?? []);
  async function act(action: "remove" | "block" | "unblock", id?: string, author?: string) {
    if (!window.confirm(`${action === "remove" ? "Remove this message" : action === "block" ? "Block this wallet from chat" : "Unblock this wallet"}?`)) return;
    setBusy(true);
    try { await moderate({ data: { pin, action, ...(id ? { id } : {}), ...(author ? { author } : {}) } }); await Promise.all([qc.invalidateQueries({ queryKey: ["community-moderation"] }), qc.invalidateQueries({ queryKey: ["community"] })]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Moderation failed."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3">
    <h2 className="text-xl font-semibold">Community moderation</h2>
    {q.isError && <p className="text-sm text-destructive">Could not load chat moderation.</p>}
    {q.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
    <details><summary className="cursor-pointer text-sm text-muted-foreground">Recent messages ({q.data?.messages.length ?? 0})</summary><div className="max-h-96 divide-y divide-border overflow-y-auto">
      {q.data?.messages.map(m => <div key={m.id} className="flex items-start gap-2 py-3"><Avatar hash={profiles[m.author]?.avatar} size={28} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{profiles[m.author]?.name ?? <HederaAddress address={m.author} />}</p><p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{m.body}</p></div><Button variant="ghost" size="icon" aria-label="Remove message" title="Remove message" disabled={busy} onClick={() => act("remove", m.id)}><Trash2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Block author" title="Block author" disabled={busy} onClick={() => act("block", undefined, m.author)}><Ban className="h-4 w-4" /></Button></div>)}
    </div></details>
    <details><summary className="cursor-pointer text-sm text-muted-foreground">Blocked wallets ({q.data?.blocks.length ?? 0})</summary>{q.data?.blocks.map(b => <div key={b.author} className="flex items-center justify-between gap-2 py-2 text-sm"><HederaAddress address={b.author} /><Button variant="ghost" size="icon" aria-label="Unblock wallet" title="Unblock wallet" disabled={busy} onClick={() => act("unblock", undefined, b.author)}><UserCheck className="h-4 w-4" /></Button></div>)}</details>
  </section>;
}