import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getXPosting, setXPosting } from "@/lib/x-posting.functions";
import image from "@/assets/x-introduction.jpg";

export function XPostingPanel({ pin }: { pin: string }) {
  const load = useServerFn(getXPosting);
  const save = useServerFn(setXPosting);
  const q = useQuery({ queryKey: ["x-posting"], queryFn: () => load({ data: { pin } }), refetchInterval: 30_000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(enabled: boolean, resume = false) {
    setBusy(true); setError("");
    try { await save({ data: { pin, enabled, resume } }); await q.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  }
  const enabled = q.data?.state?.enabled ?? true;
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Daily X posts</h2>
      <Switch aria-label="Daily X posts enabled" checked={enabled} disabled={busy || !q.data} onCheckedChange={(v) => update(v)} />
    </div>
    <p className="text-sm text-muted-foreground">10:00 · 15:00 · 20:00 Europe/Amsterdam · English · with images</p>
    <img src={image} alt="HederaPump — Create. Trade. Build your community." width={1536} height={1024} loading="lazy" className="w-full max-w-md rounded-lg" />
    {(error || q.error) && <p className="text-sm text-destructive">{error || "Could not load X posts"}</p>}
    {q.data?.state?.pause_reason && <div className="space-y-2"><p className="text-sm text-destructive">{q.data.state.pause_reason}</p><Button variant="outline" disabled={busy} onClick={() => update(true, true)}>Resume after fixing X access</Button></div>}
    {!q.data?.posts.length && <p className="text-sm text-muted-foreground">Introduction queued.</p>}
    <div className="divide-y divide-border">{q.data?.posts.map((post) => <article key={post.slot} className="space-y-1 py-3 text-sm">
      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">{post.status} · {post.slot}</span>{post.tweet_id && <a href={`https://x.com/hederapumpdev/status/${post.tweet_id}`} target="_blank" rel="noreferrer" aria-label="Open tweet"><ExternalLink className="size-4" /></a>}</div>
      <p className="whitespace-pre-line break-words">{post.text}</p>{post.error && <p className="text-destructive">{post.error}</p>}
    </article>)}</div>
  </section>;
}