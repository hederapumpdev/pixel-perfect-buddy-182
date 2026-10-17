import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { encodeAbiParameters } from "viem";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet";
import { supabase } from "@/integrations/supabase/client";
import { checkAdminPin, getBotInfo, saveBotSettings, getBotAdmin } from "@/lib/chain.functions";
import {
  NETWORK,
  PUMP_CONTRACT_V3_ID,
  PUMP_CONTRACT_V4_ID,
  HASHSCAN_URL,
  FEE_WALLET_EVM,
  FEE_WALLET_ID,
  BOT_BUY_USD,
  MIRROR_URL,
} from "@/lib/hedera-config";
import { toTinybars } from "@/lib/curve";
import { fmtAge, fmtHbar } from "@/lib/queries";
import { useUsd } from "@/lib/usd";
import artifact from "@/lib/contract-artifact-v3.json";
import artifactV4 from "@/lib/contract-artifact-v4.json";

// Deploy targets the newest contract not yet on mainnet (v4 once v3 is live).
const DEPLOY_TARGET = PUMP_CONTRACT_V3_ID && !PUMP_CONTRACT_V4_ID ? artifactV4 : artifact;
const DEPLOYED_ID = PUMP_CONTRACT_V4_ID ?? PUMP_CONTRACT_V3_ID;
import { listSupport, setSupportStatus } from "@/lib/support.functions";
import { XPostingPanel } from "@/components/XPostingPanel";
import { getUserStats } from "@/lib/users.functions";
import { userRows } from "@/lib/user-stats";
import { Avatar } from "@/components/ProfileEditor";

// SaucerSwap V1 mainnet (docs.saucerswap.finance/developers/contracts)
const SAUCER_ROUTER_EVM = "0x00000000000000000000000000000000002e7a5d"; // 0.0.3045981
const SAUCER_FACTORY_EVM = "0x0000000000000000000000000000000000103680"; // 0.0.1062784
const PLATFORM_SHARE = 0.7;


export const Route = createFileRoute("/admin")({
  staticData: { sitemap: "exclude-subtree" },
  head: () => ({
    meta: [
      { title: "Admin — HederaPump" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Platform fees, top coins and the HederaPump bot." },
      { property: "og:title", content: "Admin — HederaPump" },
      { property: "og:description", content: "Platform fees, top coins and the bot." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const PIN_KEY = "hederaPump.adminPin";

function Admin() {
  const check = useServerFn(checkAdminPin);
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(PIN_KEY);
    } catch {
      /* storage blocked */
    }
    if (saved) check({ data: { pin: saved } }).then((r) => setOk(r.ok)).catch(() => {});
  }, [check]);
  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    // Read the field itself: phone autofill can fill it without React noticing.
    const value = (new FormData(e.currentTarget as HTMLFormElement).get("pin") ?? pin).toString().trim();
    if (!value) {
      setErr("Enter the PIN first.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await check({ data: { pin: value } });
      if (!r.ok) {
        setErr("Wrong PIN — check it and try again.");
        return;
      }
      try {
        sessionStorage.setItem(PIN_KEY, value);
      } catch {
        /* storage blocked */
      }
      setPin(value);
      setOk(true);
    } catch {
      setErr("Couldn't check the PIN. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!ok)
    return (
      <Shell>
        <form onSubmit={unlock} className="mx-auto max-w-sm space-y-3 py-16 text-center">
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">Enter the admin PIN.</p>
          <Input name="pin" type="password" autoComplete="off" defaultValue="" onChange={(e) => setPin(e.target.value)} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Open"}
          </Button>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </form>
      </Shell>
    );
  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-10">
        <h1 className="text-3xl font-bold">Admin</h1>
        <UsersOverview />
        <SupportInbox />
        <XPostingPanel pin={pin || sessionStorage.getItem(PIN_KEY) || ""} />
        <FeeOverview />
        <TopCoins />
        <BotPanel />
        <Deploy />
      </div>
    </Shell>
  );
}

function useAll() {
  return useQuery({
    queryKey: ["admin-data"],
    queryFn: async () => {
      const [{ data: tokens, error: e1 }, { data: trades, error: e2 }] = await Promise.all([
        supabase.from("tokens").select("*").eq("network", NETWORK).limit(1000),
        supabase
          .from("trades")
          .select("token,fee,hbar_amount,created_at")
          .eq("network", NETWORK)
          .order("created_at", { ascending: false })
          .limit(10000),
      ]);
      if (e1 || e2) throw e1 ?? e2;
      return { tokens: tokens ?? [], trades: trades ?? [] };
    },
    refetchInterval: 30_000,
  });
}

function FeeOverview() {
  const q = useAll();
  const s = useMemo(() => {
    const now = Date.now();
    let total = 0,
      day = 0,
      week = 0;
    const per = new Map<string, number>();
    for (const t of q.data?.trades ?? []) {
      const f = Number(t.fee) * PLATFORM_SHARE;
      const age = now - new Date(t.created_at).getTime();
      total += f;
      if (age < 86_400_000) day += f;
      if (age < 7 * 86_400_000) week += f;
      per.set(t.token, (per.get(t.token) ?? 0) + f);
    }
    const names = new Map((q.data?.tokens ?? []).map((t) => [t.address, t]));
    const list = [...per]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([addr, f]) => ({ addr, f, t: names.get(addr) }));
    return { total, day, week, list };
  }, [q.data]);
  const usd = useUsd();

  return (
    <section>
      <h2 className="text-xl font-semibold">Platform fees</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your 70% share of the 1% trading fee, from all trades. On the newest contract it lands in{" "}
        {FEE_WALLET_ID} immediately; older contracts keep it until claimed.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Today" value={fmtHbar(s.day)} sub={usd(s.day)} />
        <Stat label="Last 7 days" value={fmtHbar(s.week)} sub={usd(s.week)} />
        <Stat label="All time" value={fmtHbar(s.total)} sub={usd(s.total)} />
      </div>
      <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card text-sm">
        {s.list.map((r) => (
          <Link key={r.addr} to="/token/$id" params={{ id: r.addr }} className="flex justify-between gap-3 px-4 py-2 hover:bg-muted/40">
            <span>{r.t ? `$${r.t.symbol}` : r.addr.slice(0, 10)}</span>
            <span className="font-mono">
              {fmtHbar(r.f)} <span className="text-muted-foreground">· {usd(r.f)}</span>
            </span>
          </Link>
        ))}
        {!s.list.length && <p className="px-4 py-3 text-muted-foreground">{q.isLoading ? "Loading…" : "No fees yet."}</p>}
      </div>
    </section>
  );
}

function TopCoins() {
  const q = useAll();
  const [sort, setSort] = useState<"mc" | "vol" | "grad">("mc");
  const rows = useMemo(() => {
    const day = Date.now() - 86_400_000;
    const vol = new Map<string, number>();
    for (const t of q.data?.trades ?? [])
      if (new Date(t.created_at).getTime() > day) vol.set(t.token, (vol.get(t.token) ?? 0) + Number(t.hbar_amount));
    return (q.data?.tokens ?? [])
      .map((t) => {
        const price = Number(t.virtual_tokens) > 0 ? Number(t.virtual_hbar) / Number(t.virtual_tokens) : 0;
        return {
          t,
          mc: price * 1_000_000_000,
          vol: vol.get(t.address) ?? 0,
          grad: t.graduated ? 100 : Math.min(100, (Number(t.tokens_sold) / 800_000_000) * 100),
        };
      })
      .sort((a, b) => b[sort] - a[sort])
      .slice(0, 20);
  }, [q.data, sort]);
  const usd = useUsd();

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Top coins</h2>
        <div className="flex gap-1">
          {(
            [
              ["mc", "Market cap"],
              ["vol", "Volume 24h"],
              ["grad", "Graduation"],
            ] as const
          ).map(([k, l]) => (
            <Button key={k} size="sm" variant={sort === k ? "default" : "outline"} onClick={() => setSort(k)}>
              {l}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card text-sm">
        {rows.map((r, i) => (
          <Link key={r.t.address} to="/token/$id" params={{ id: r.t.address }} className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 px-4 py-2 hover:bg-muted/40">
            <span className="text-muted-foreground">{i + 1}</span>
            <span className="truncate">${r.t.symbol}</span>
            <span className="font-mono">
              {fmtHbar(r.mc)} <span className="text-muted-foreground">· {usd(r.mc)}</span>
            </span>
            <span className="font-mono text-muted-foreground">
              {fmtHbar(r.vol)} <span className="opacity-70">· {usd(r.vol)}</span>
            </span>
            <span className="font-mono">{r.grad.toFixed(1)}%</span>
          </Link>
        ))}
        {!rows.length && <p className="px-4 py-3 text-muted-foreground">No coins yet.</p>}
      </div>
    </section>
  );
}

function BotPanel() {
  const info = useServerFn(getBotInfo);
  const bot = useQuery({ queryKey: ["bot-info"], queryFn: () => info(), refetchInterval: 30_000 });
  const botAdmin = useServerFn(getBotAdmin);
  const adminData = useQuery({
    queryKey: ["bot-admin"],
    queryFn: () => {
      let p = "";
      try {
        p = sessionStorage.getItem(PIN_KEY) ?? "";
      } catch {
        /* blocked */
      }
      return botAdmin({ data: { pin: p } });
    },
    refetchInterval: 30_000,
  });
  const buys = { data: adminData.data?.buys };
  const names = new Map((useAll().data?.tokens ?? []).map((t) => [t.address, t.symbol]));
  const b = bot.data;
  const usdOf = useUsd();
  const save = useServerFn(saveBotSettings);
  const cfg = { data: adminData.data?.settings };
  const [enabled, setEnabled] = useState(true);
  const [usd, setUsd] = useState(String(BOT_BUY_USD));
  const [pin, setPin] = useState(() => {
    try {
      return sessionStorage.getItem(PIN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (cfg.data) {
      setEnabled(cfg.data.enabled);
      setUsd(String(cfg.data.usd_amount));
    }
  }, [cfg.data]);
  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { pin: pin.trim(), enabled, usd: Number(usd) } });
      toast.success("Bot settings saved");
      adminData.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saving failed");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section>
      <h2 className="text-xl font-semibold">Auto-buy bot</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Buys a fixed dollar amount of every new coin, once. It stops by itself when its balance drops below 5 HBAR.
        Send HBAR to the address below to fund it.
      </p>
      <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Bot is {enabled ? "on" : "off"}</span>
          <Button size="sm" variant={enabled ? "default" : "outline"} onClick={() => setEnabled(!enabled)}>
            {enabled ? "Turn off" : "Turn on"}
          </Button>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Amount per new coin (USD)</span>
          <Input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="font-mono" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Admin PIN</span>
          <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </label>
        <Button className="w-full" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save bot settings"}
        </Button>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-card p-4 text-sm">
        <p className="text-xs text-muted-foreground">Bot address</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="break-all font-mono">{b?.address ?? "…"}</span>
          {b && (
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(b.address).then(() => toast.success("Copied"))}>
              Copy
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Account / balance</p>
        <p className="font-mono">
          {b?.accountId ? (
            <a href={`${HASHSCAN_URL}/account/${b.accountId}`} target="_blank" rel="noreferrer" className="text-accent">
              {b.accountId}
            </a>
          ) : (
            "Not funded yet"
          )}{" "}
          · {fmtHbar(b?.balanceHbar ?? 0)} <span className="text-muted-foreground">· {usdOf(b?.balanceHbar ?? 0)}</span>
        </p>
      </div>
      <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card font-mono text-xs">
        {buys.data?.map((r) => (
          <div key={r.token} className="flex justify-between gap-2 px-4 py-2">
            <span>{names.get(r.token) ?? r.token.slice(0, 10)}</span>
            <span>{fmtHbar(Number(r.hbar_amount))} <span className="text-muted-foreground">{usdOf(Number(r.hbar_amount))}</span></span>
            <span className={r.status === "done" ? "text-up" : r.status === "failed" ? "text-down" : "text-muted-foreground"}>{r.status}</span>
            <span className="text-muted-foreground">{fmtAge(r.created_at)}</span>
          </div>
        ))}
        {buys.data && !buys.data.length && <p className="px-4 py-3 text-muted-foreground">No buys yet.</p>}
      </div>
    </section>
  );
}

function Deploy() {
  const w = useWallet();
  const [virtualHbar, setV] = useState("20000");
  const [creationFee, setFee] = useState("10");
  const [busy, setBusy] = useState(false);
  const [deployed, setDeployed] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const p = w.deployProgress;

  useEffect(() => {
    if (w.accountId && w.mode === "hashpack" && !DEPLOYED_ID) {
      w.checkDeploy(DEPLOY_TARGET.bytecode).then((s) => s.contractId && setDeployed(s.contractId)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.accountId, w.mode]);

  async function deploy() {
    if (!w.accountId || !w.evmAddress) return w.connect();
    setBusy(true);
    setLastError(null);
    try {
      const params = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "address" }],
        [
          FEE_WALLET_EVM as `0x${string}`,
          toTinybars(virtualHbar),
          toTinybars(creationFee),
          SAUCER_ROUTER_EVM as `0x${string}`,
          SAUCER_FACTORY_EVM as `0x${string}`,
        ],
      );
      const r = await w.deploy({ bytecode: DEPLOY_TARGET.bytecode, constructorParams: params, gas: 6_000_000 });
      if (r.contractId) {
        setDeployed(r.contractId);
        toast.success(`Deployed ${r.contractId}`);
      } else {
        toast.success(`Approval ${r.done} of ${r.approvals} done — tap the button for the next one.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deploy failed";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const next = p ? Math.min(p.done + 1, p.approvals) : 1;
  const total = p?.approvals ?? 6;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Launchpad contract</h2>
      {DEPLOYED_ID ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm">
          Live contract:{" "}
          <a className="font-mono text-accent" href={`${HASHSCAN_URL}/contract/${DEPLOYED_ID}`} target="_blank" rel="noreferrer">
            {DEPLOYED_ID}
          </a>
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Deploys the new contract to Hedera {NETWORK}: platform fee goes straight to {FEE_WALLET_ID}, creators
            claim their share on their profile. <b>About 6 approvals</b>, one per tap. Roughly 20–30 HBAR.
          </p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Starting virtual liquidity (HBAR)</span>
            <Input value={virtualHbar} onChange={(e) => setV(e.target.value)} className="font-mono" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Creation fee (HBAR)</span>
            <Input value={creationFee} onChange={(e) => setFee(e.target.value)} className="font-mono" />
          </label>
          {p && !deployed && (
            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${(p.done / p.approvals) * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {p.done} of {p.approvals} approvals done
              </p>
            </div>
          )}
          {!deployed && (
            <Button className="w-full" size="lg" disabled={busy} onClick={deploy}>
              {!w.accountId
                ? "Connect wallet"
                : busy
                  ? `Approval ${next} of ${total} — open HashPack and approve…`
                  : p && p.done > 0
                    ? `Continue: approval ${next} of ${total}`
                    : `Start deploy: approval 1 of ${total}`}
            </Button>
          )}
          {busy && (
            <p className="rounded-md border border-border bg-card p-3 text-center text-xs text-muted-foreground">
              Switch to <b>HashPack</b> now and approve, then come back. Nothing is paid twice.
            </p>
          )}
          {!busy && lastError && <p className="text-center text-xs text-destructive">{lastError}</p>}
          {deployed && (
            <p className="rounded-md border border-up/40 bg-up/10 p-4 text-sm">
              Deployed: <b className="font-mono">{deployed}</b> — send this ID in the chat to switch the launchpad on.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SupportInbox() {
  const list = useServerFn(listSupport);
  const setStatus = useServerFn(setSupportStatus);
  const pin = (() => {
    try {
      return sessionStorage.getItem(PIN_KEY) ?? "";
    } catch {
      return "";
    }
  })();
  const q = useQuery({ queryKey: ["support"], queryFn: () => list({ data: { pin } }), refetchInterval: 60_000 });
  const open = (q.data ?? []).filter((r) => r.status === "open").length;
  async function toggle(id: string, status: "open" | "done") {
    try {
      await setStatus({ data: { pin, id, status } });
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saving failed");
    }
  }
  return (
    <section>
      <h2 className="text-xl font-semibold">Support requests {open > 0 && <span className="text-primary">({open} open)</span>}</h2>
      {q.error && <p className="mt-2 text-sm text-destructive">Couldn't load requests — reopen the admin page with your PIN.</p>}
      {q.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No requests yet.</p>}
      <div className="mt-3 space-y-3">
        {(q.data ?? []).map((r) => (
          <div key={r.id} className={`rounded-lg border border-border p-3 text-sm ${r.status === "done" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{r.contact}</span>
              <span className="text-xs text-muted-foreground">{fmtAge(r.created_at)}</span>
            </div>
            {r.wallet && <div className="mt-1 font-mono text-xs text-muted-foreground">{r.wallet}</div>}
            <p className="mt-2 whitespace-pre-wrap">{r.message}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => toggle(r.id, r.status === "done" ? "open" : "done")}>
              {r.status === "done" ? "Reopen" : "Mark as done"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const num = (n: number | undefined) => (n === undefined ? "…" : String(n));

function UsersOverview() {
  const stats = useServerFn(getUserStats);
  const pin = (() => {
    try {
      return sessionStorage.getItem(PIN_KEY) ?? "";
    } catch {
      return "";
    }
  })();
  const q = useQuery({ queryKey: ["user-stats"], queryFn: () => stats({ data: { pin } }), refetchInterval: 60_000 });
  const rows = userRows(q.data);
  return (
    <section>
      <h2 className="text-xl font-semibold">Users</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A wallet counts here as soon as it has traded — the site keeps no account list of its own.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Stat label="Wallets" value={num(q.data?.wallets)} />
        <Stat label="Active today" value={num(q.data?.wallets_1d)} />
        <Stat label="Active 7 days" value={num(q.data?.wallets_7d)} />
        <Stat label="Profiles" value={num(q.data?.profiles)} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Stat label="Coin creators" value={num(q.data?.creators)} />
        <Stat label="Coins" value={num(q.data?.coins)} />
        <Stat label="Trades" value={num(q.data?.trades)} />
        <Stat label="Commenters" value={num(q.data?.comment_authors)} />
      </div>
      <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card text-sm">
        {rows.map((r) => (
          <div key={r.wallet} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar hash={r.avatar} size={24} />
              <span className="truncate font-medium">{r.label}</span>
            </span>
            <span className="font-mono text-muted-foreground">{r.trades} {r.trades === 1 ? "trade" : "trades"}</span>
            <span className="w-20 text-right text-xs text-muted-foreground">{fmtAge(r.last_at)}</span>
          </div>
        ))}
        {!rows.length && <p className="px-4 py-3 text-muted-foreground">{q.isLoading ? "Loading…" : "No users yet."}</p>}
      </div>
      {q.error && <p className="mt-2 text-sm text-destructive">Couldn't load user counts — reopen the admin page with your PIN.</p>}
    </section>
  );
}
