import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, useProfiles } from "@/components/ProfileEditor";
import { StaffBadge } from "@/components/StaffBadge";
import { HederaAddress } from "@/components/HederaAddress";
import { useWallet } from "@/lib/wallet";
import { communityQuery } from "@/lib/community-query";
import { chatLoginMessage, CHAT_MAX_LENGTH } from "@/lib/community";
import { loginCommunity, postCommunity } from "@/lib/community.functions";

export const Route = createFileRoute("/community")({
  staticData: { sitemap: true },
  head: () => ({ meta: [
    { title: "Community — HederaPump" },
    { name: "description", content: "Discuss Hedera meme coins, creator ideas and market analysis with the HederaPump community." },
    { property: "og:title", content: "Community — HederaPump" },
    { property: "og:description", content: "HederaPump community conversations, coin ideas and analysis." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(communityQuery),
  component: Community,
});

function Community() {
  const { data: messages } = useSuspenseQuery(communityQuery);
  const profiles = useProfiles(messages.map(m => m.author));
  const wallet = useWallet();
  const author = (wallet.accountId ?? wallet.evmAddress)?.toLowerCase();
  const login = useServerFn(loginCommunity);
  const post = useServerFn(postCommunity);
  const qc = useQueryClient();
  const [session, setSession] = useState<{ token: string; author: string; expiresAt: string } | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  useEffect(() => {
    const list = listRef.current;
    if (list && nearBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages.length]);
  const signedIn = session && session.author === author && Date.parse(session.expiresAt) > Date.now();
  async function signIn() {
    if (!author) return;
    setBusy(true);
    try {
      const time = new Date().toISOString();
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
      const sig = await wallet.signText(chatLoginMessage(author, time, nonce));
      setSession(await login({ data: { author, time, nonce, ...sig } }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chat sign-in failed."); }
    finally { setBusy(false); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn || !session || busy) return;
    setBusy(true);
    try {
      await post({ data: { token: session.token, body } });
      setBody("");
      nearBottom.current = true;
      await qc.invalidateQueries({ queryKey: ["community"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send."); }
    finally { setBusy(false); }
  }
  return <Shell>
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <MessageCircle className="h-8 w-8 shrink-0 text-primary" />
        <div><h1 className="text-3xl font-bold">Community</h1><p className="text-sm text-muted-foreground">HederaPump · General chat</p></div>
      </div>
      <div className="flex items-center gap-2 border-y border-border py-3 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />No spam, impersonation or recovery phrases. Opinions are not financial advice.</div>
      <div ref={listRef} role="log" aria-label="Community messages" onScroll={() => { const el = listRef.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="h-[min(55dvh,640px)] min-h-64 overflow-y-auto py-3">
        {messages.map(m => <article key={m.id} className="flex gap-3 py-4">
          <Avatar hash={profiles[m.author]?.avatar} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><span className="font-semibold">{profiles[m.author]?.name ?? <HederaAddress address={m.author} />}</span><StaffBadge wallet={m.author} /><time dateTime={m.created_at} className="text-xs text-muted-foreground">{new Date(m.created_at).toISOString().slice(11, 16)} UTC</time></div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{m.body}</p>
          </div>
        </article>)}
        {!messages.length && <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"><MessageCircle className="h-10 w-10 text-primary" /><p>No messages yet.</p></div>}
      </div>
      <div className="border-t border-border pt-4">
        {signedIn ? <form onSubmit={send} className="space-y-2">
          <div className="flex items-end gap-2"><Textarea aria-label="Message" value={body} onChange={e => setBody(e.target.value)} maxLength={CHAT_MAX_LENGTH} rows={3} placeholder="Share a coin idea or analysis…" className="min-w-0 flex-1 resize-none" /><Button type="submit" size="icon" aria-label="Send message" title="Send message" disabled={busy || !body.trim()}><Send className="h-4 w-4" /></Button></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{author}</span><span>{body.length}/{CHAT_MAX_LENGTH}</span></div>
        </form> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Sign in to join the conversation.</p><div className="flex flex-wrap gap-2">{author ? <Button onClick={signIn} disabled={busy}>{busy ? "Waiting for signature…" : "Sign in to chat"}</Button> : <><Button variant="secondary" onClick={wallet.connectEmail} disabled={wallet.connecting}>Sign in</Button><Button onClick={wallet.connect} disabled={wallet.connecting}>WalletConnect</Button></>}</div></div>}
      </div>
    </div>
  </Shell>;
}