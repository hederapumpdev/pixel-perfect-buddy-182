import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listComments, postComment } from "@/lib/comments.functions";
import { MIRROR_URL } from "@/lib/hedera-config";
import { fmtAge } from "@/lib/queries";
import { HederaAddress } from "@/components/HederaAddress";
import { Avatar, useProfiles } from "@/components/ProfileEditor";
import { StaffBadge } from "@/components/StaffBadge";

type Trade = { trader: string; is_buy: boolean; token_amount: number | string };

export function Comments({ token, author }: { token: string; author: string | null }) {
  const list = useServerFn(listComments);
  const post = useServerFn(postComment);
  const qc = useQueryClient();
  const key = ["comments", token.toLowerCase()];
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { token } }),
    refetchInterval: 15_000,
  });
  const profs = useProfiles(data.map((c) => c.author));
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!author) {
      toast.error("Connect your wallet to comment");
      return;
    }
    setBusy(true);
    try {
      await post({ data: { token, author, body } });
      setBody("");
      qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <p className="border-b border-border px-4 py-3 text-sm font-semibold">
        Comments <span className="text-muted-foreground">({data.length})</span>
      </p>
      <form onSubmit={send} className="flex gap-2 border-b border-border p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={author ? "Say something about this coin…" : "Connect your wallet to comment"}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || !body.trim()}>
          Post
        </Button>
      </form>
      <div className="divide-y divide-border">
        {data.map((c) => (
          <div key={c.id} className="flex gap-3 px-4 py-3 text-sm">
            <Avatar hash={profs[c.author.toLowerCase()]?.avatar} size={32} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {profs[c.author.toLowerCase()]?.name ?? <HederaAddress address={c.author} />}
                </span>{" "}<StaffBadge wallet={c.author} />{" "}
                · {fmtAge(c.created_at)} ago
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          </div>
        ))}
        {!data.length && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}

/** HTS coins: real balances from the mirror. v1 coins: net curve trades. */
export function Holders({
  tokenId,
  decimals,
  creator,
  contract,
  trades,
  supply,
}: {
  tokenId: string | null;
  decimals: number;
  creator: string;
  contract: string;
  trades: Trade[];
  supply: number;
}) {
  const [rows, setRows] = useState<{ who: string; amt: number }[]>([]);
  useEffect(() => {
    let off = false;
    (async () => {
      if (tokenId) {
        try {
          const r = await fetch(
            `${MIRROR_URL}/api/v1/tokens/${tokenId}/balances?limit=100&order=desc&account.balance=gt:0`,
          );
          const j = await r.json();
          const list = (j.balances ?? []).map((b: { account: string; balance: number }) => ({
            who: b.account,
            amt: b.balance / 10 ** decimals,
          }));
          list.sort((a: { amt: number }, b: { amt: number }) => b.amt - a.amt);
          if (!off) setRows(list.slice(0, 20));
          return;
        } catch {
          /* fall back to trades */
        }
      }
      const m = new Map<string, number>();
      for (const t of trades) {
        const a = Number(t.token_amount) * (t.is_buy ? 1 : -1);
        m.set(t.trader, (m.get(t.trader) ?? 0) + a);
      }
      const list = [...m].filter(([, v]) => v > 0).map(([who, amt]) => ({ who, amt }));
      list.sort((a, b) => b.amt - a.amt);
      if (!off) setRows(list.slice(0, 20));
    })();
    return () => {
      off = true;
    };
  }, [tokenId, decimals, trades.length]);

  const cId = contract.toLowerCase();
  const cr = creator.toLowerCase();
  const profiles = useProfiles(rows.map((r) => r.who));
  return (
    <div className="rounded-lg border border-border bg-card">
      <p className="border-b border-border px-4 py-3 text-sm font-semibold">Top holders</p>
      <div className="divide-y divide-border font-mono text-xs">
        {rows.map((r, i) => {
          const w = r.who.toLowerCase();
          const tag = w === cId ? "bonding curve" : w === cr ? "dev" : null;
          return (
            <div key={r.who} className="flex items-center justify-between gap-2 px-4 py-2">
              <span className="flex min-w-0 items-center gap-2" title={r.who}>
                <span className="shrink-0">{i + 1}.</span>
                {profiles[w] && <Avatar hash={profiles[w]?.avatar} size={24} />}
                <span className="truncate">{profiles[w]?.name ?? <HederaAddress address={r.who} />}</span><StaffBadge wallet={r.who} />
                {tag && (
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-primary">{tag}</span>
                )}
              </span>
              <span className="shrink-0">{((r.amt / supply) * 100).toFixed(2)}%</span>
            </div>
          );
        })}
        {!rows.length && <p className="px-4 py-6 text-center text-muted-foreground">No holders yet.</p>}
      </div>
    </div>
  );
}
