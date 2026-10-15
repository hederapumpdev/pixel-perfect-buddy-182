import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a coin — HederaPump" },
      { name: "description", content: "Launch your own meme coin on Hedera with a fair bonding curve." },
      { property: "og:title", content: "Create a coin — HederaPump" },
      { property: "og:description", content: "Launch a meme coin on Hedera in minutes." },
    ],
  }),
  component: Create,
});

function Create() {
  const [f, setF] = useState({ name: "", ticker: "", description: "", website: "", x: "", telegram: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(f.ticker);
  return (
    <Shell>
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold">Create a coin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fixed supply of 1,000,000,000 tokens. Everyone buys on the same curve — no presale, no team allocation.</p>
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); toast("Launching is disabled in this preview. Real token creation on Hedera comes next."); }}>
          <Field label="Name"><Input value={f.name} onChange={set("name")} maxLength={32} placeholder="Hashcat" /></Field>
          <Field label="Ticker"><Input value={f.ticker} onChange={(e) => setF({ ...f, ticker: e.target.value.toUpperCase() })} maxLength={10} placeholder="HCAT" className="font-mono" /></Field>
          <Field label="Description"><Textarea value={f.description} onChange={set("description")} maxLength={280} rows={3} /></Field>
          <Field label="Image"><Input type="file" accept="image/*" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Website"><Input value={f.website} onChange={set("website")} placeholder="https://" /></Field>
            <Field label="X"><Input value={f.x} onChange={set("x")} placeholder="@handle" /></Field>
            <Field label="Telegram"><Input value={f.telegram} onChange={set("telegram")} placeholder="t.me/…" /></Field>
          </div>
          <div className="rounded-md border border-border bg-card p-3 font-mono text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Creation fee</span><span>~10 ℏ + network fee</span></div>
            <div className="flex justify-between"><span>Network</span><span className="text-warn">Hedera Testnet</span></div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!ok}>Launch coin</Button>
        </form>
      </div>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
