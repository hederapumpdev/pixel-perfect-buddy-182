import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bot, Send } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/lib/wallet";
import { submitSupport } from "@/lib/support.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — HederaPump" },
      { name: "description", content: "Get help with HederaPump from our support AI or contact a human." },
      { property: "og:title", content: "Support — HederaPump" },
      { property: "og:description", content: "Ask the support AI or send a request to the HederaPump team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Support,
});

type Msg = { role: "user" | "assistant"; content: string };

function Support() {
  return (
    <Shell>
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask the support AI first. Still stuck? Send a request to the team below. We never ask for your seed phrase.
          </p>
        </div>
        <Chat />
        <Contact />
      </div>
    </Shell>
  );
}

function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Support AI unavailable");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
        end.current?.scrollIntoView({ block: "nearest" });
      }
    } catch (err) {
      setMsgs([...next, { role: "assistant", content: `_${err instanceof Error ? err.message : "Something went wrong"} — use the form below._` }]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Bot className="h-5 w-5 text-primary" /> Support AI
      </h2>
      <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto">
        {msgs.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask anything, e.g. "Why does my transaction fail?" or "How do I claim my creator fees?"</p>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              {m.content}
            </div>
          ) : (
            <div key={i} className="prose prose-sm prose-invert max-w-none text-sm">
              {m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span className="text-muted-foreground">Thinking…</span>}
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" maxLength={2000} />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}

function Contact() {
  const w = useWallet();
  const submit = useServerFn(submitSupport);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await submit({
        data: {
          contact: String(f.get("contact") ?? ""),
          wallet: String(f.get("wallet") ?? ""),
          message: String(f.get("message") ?? ""),
        },
      });
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sending failed");
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        Thanks — the team received your request and will get back to you.
      </section>
    );
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">Contact a human</h2>
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <Input name="contact" placeholder="Email or Telegram / X handle" required maxLength={200} />
        <Input name="wallet" placeholder="Wallet / account ID (optional)" defaultValue={w.accountId ?? ""} maxLength={100} />
        <Textarea name="message" placeholder="What's going on? Add the coin and transaction if you can." required rows={5} maxLength={4000} />
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
      </form>
    </section>
  );
}
