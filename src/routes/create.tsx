import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/lib/wallet";
import { syncChain, uploadImage } from "@/lib/chain.functions";
import { supabase } from "@/integrations/supabase/client";
import { GAS, MIRROR_URL, NETWORK, PUMP_CONTRACT_ID } from "@/lib/hedera-config";
import { toTinybars } from "@/lib/curve";
import { encodePump, encodeToken } from "@/lib/curve";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a coin — HederaPump" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "description",
        content: "Launch your own meme coin on Hedera with a fair bonding curve.",
      },
      { property: "og:title", content: "Create a coin — HederaPump" },
      { property: "og:description", content: "Launch a meme coin on Hedera in minutes." },
    ],
  }),
  component: Create,
});

async function readCreationFee(): Promise<bigint> {
  const data = (PUMP_CONTRACT_V2_ID ? encodePumpV2 : encodePump)("creationFee");
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data, to: await contractEvm(), estimate: false }),
  });
  const j = await r.json();
  return BigInt(j.result ?? "0x0");
}
async function contractEvm() {
  const r = await fetch(
    `${MIRROR_URL}/api/v1/contracts/${PUMP_CONTRACT_V2_ID ?? PUMP_CONTRACT_ID}`,
  );
  return (await r.json()).evm_address as string;
}

const fileToB64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

function Create() {
  const w = useWallet();
  const nav = useNavigate();
  const upload = useServerFn(uploadImage);
  const sync = useServerFn(syncChain);
  const [f, setF] = useState({
    name: "",
    ticker: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    firstBuy: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(f.ticker);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!PUMP_CONTRACT_ID) return toast.error("The launchpad contract isn't deployed yet.");
    if (!w.accountId) return w.connect();
    try {
      let image: string | undefined;
      if (file) {
        if (file.size > 400_000) throw new Error("Image must be under 400 KB");
        setBusy("Uploading image…");
        image = (await upload({ data: { mime: file.type, base64: await fileToB64(file) } })).hash;
      }
      const meta = JSON.stringify({
        image,
        description: f.description.trim() || undefined,
        website: f.website.trim() || undefined,
        twitter: f.twitter.trim() || undefined,
        telegram: f.telegram.trim() || undefined,
      });
      if (new TextEncoder().encode(meta).length > 1024)
        throw new Error("Description and links are too long");
      setBusy("Reading creation fee…");
      const fee = await readCreationFee();
      const firstBuy = f.firstBuy ? toTinybars(f.firstBuy) : 0n;
      setBusy("Confirm in your wallet…");
      const calldata = encodePump("createToken", [f.name.trim(), f.ticker, meta]);
      const { transactionHash } = await w.execute({
        calldata,
        gas: GAS.create,
        payableTinybars: fee + firstBuy,
      });
      setBusy("Waiting for the network…");
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        await sync().catch(() => {});
        const { data } = await supabase
          .from("tokens")
          .select("address")
          .eq("created_tx", transactionHash)
          .maybeSingle();
        if (data) {
          toast.success("Coin launched!");
          return nav({ to: "/token/$id", params: { id: data.address } });
        }
      }
      toast.success("Coin launched — it will appear in the list shortly.");
      nav({ to: "/explore" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold">Create a coin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fixed supply of 1,000,000,000. 800M are sold on the price curve; 200M are reserved for the
          DEX pool at graduation. No presale, no team allocation.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field label="Name">
            <Input value={f.name} onChange={set("name")} maxLength={32} placeholder="Hashcat" />
          </Field>
          <Field label="Ticker">
            <Input
              value={f.ticker}
              onChange={(e) =>
                setF({ ...f, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })
              }
              maxLength={10}
              placeholder="HCAT"
              className="font-mono"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={f.description}
              onChange={set("description")}
              maxLength={500}
              rows={3}
            />
          </Field>
          <Field label="Image (max 400 KB)">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Website">
              <Input
                value={f.website}
                onChange={set("website")}
                placeholder="https://"
                maxLength={120}
              />
            </Field>
            <Field label="X">
              <Input
                value={f.twitter}
                onChange={set("twitter")}
                placeholder="@handle"
                maxLength={60}
              />
            </Field>
            <Field label="Telegram">
              <Input
                value={f.telegram}
                onChange={set("telegram")}
                placeholder="t.me/…"
                maxLength={80}
              />
            </Field>
          </div>
          <Field label="Buy at launch (optional, HBAR)">
            <Input
              inputMode="decimal"
              value={f.firstBuy}
              onChange={(e) => setF({ ...f, firstBuy: e.target.value.replace(/[^0-9.]/g, "") })}
              placeholder="0"
              className="font-mono"
            />
          </Field>
          <div className="rounded-md border border-border bg-card p-3 font-mono text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Creation fee</span>
              <span>set by the contract, shown in wallet</span>
            </div>
            <div className="flex justify-between">
              <span>Trading fee</span>
              <span>1% (30% of it goes to you)</span>
            </div>
            <div className="flex justify-between">
              <span>Network</span>
              <span className={NETWORK === "mainnet" ? "text-up" : "text-warn"}>
                Hedera {NETWORK}
              </span>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!ok || !!busy}>
            {busy ?? (w.accountId ? "Launch coin" : "Connect wallet to launch")}
          </Button>
        </form>
      </div>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
