// Server-only Hold Out engine: weekly snapshots from the mirror node, weekly plans, payouts.
// Every payout row has a unique <period>:<account> key claimed before sending; an unclear
// send is marked "unknown" and never resent.
import { FEE_WALLET_ID, MIRROR_URL, NETWORK, HTS_CONTRACTS } from "./hedera-config";
import { BOT_WALLET_EVM } from "./promotions";
import { fundWallet, FUND_WALLETS, idToEvm, mirrorAccount, WALLET_RESERVE } from "./fund-wallets.server";
import { botFee } from "./bot.server";
import {
  HOLDOUT_START,
  allocate,
  applyMinimum,
  lotWeight,
  periodKey,
  periodStart,
  rewardWeights,
  snapshotSlots,
  updateLots,
  type Lot,
} from "./holdout";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
const DAY = 86_400_000;
const WEI = 10_000_000_000n;

export const tokenIdOf = (address: string) =>
  address.startsWith("0x") ? `0.0.${BigInt(address)}` : address;

async function accountIdOf(addr: string, cache: Map<string, string | null>) {
  if (/^0\.0\.\d+$/.test(addr)) return addr;
  const k = addr.toLowerCase();
  if (!cache.has(k)) cache.set(k, (await mirrorAccount(k))?.accountId ?? null);
  return cache.get(k) ?? null;
}

/** HTS coins taking part (v1 coins live inside the old contract and have no HTS balances). */
export async function holdoutTokens(db: Db) {
  const { data } = await db.from("tokens").select("address,contract,creator,created_at,symbol").eq("network", NETWORK);
  return ((data ?? []) as { address: string; contract: string; creator: string; created_at: string; symbol: string }[])
    .filter((t) => HTS_CONTRACTS.includes(t.contract));
}

async function balancesAt(tokenId: string, atMs: number) {
  const out: { account: string; balance: bigint }[] = [];
  let url: string | null = `${MIRROR_URL}/api/v1/tokens/${tokenId}/balances?limit=100&timestamp=lte:${Math.floor(atMs / 1000)}.000000000`;
  for (let i = 0; url && i < 30; i++) {
    const r: Response = await fetch(url);
    if (!r.ok) throw new Error(`mirror ${r.status}`);
    const j = await r.json();
    for (const b of j.balances ?? []) if (BigInt(b.balance ?? 0) > 0n) out.push({ account: b.account, balance: BigInt(b.balance) });
    url = j.links?.next ? `${MIRROR_URL}${j.links.next}` : null;
  }
  return out;
}

/** Takes up to `max` due snapshots, oldest first per coin, so lots stay in order. */
async function takeSnapshots(db: Db, now: number, max = 3) {
  const tokens = await holdoutTokens(db);
  const cur = periodStart(new Date(now));
  const starts = [new Date(cur.getTime() - 7 * DAY), cur].filter((s) => s.getTime() >= Date.parse(HOLDOUT_START));
  const slots = starts.flatMap((s) => snapshotSlots(s).map((t) => ({ t: t.getTime(), period: periodKey(s) }))).filter((s) => s.t <= now);
  if (!slots.length) return 0;
  const { data: have } = await db.from("holdout_snapshots").select("token,slot").in("period", starts.map(periodKey));
  const done = new Set((have ?? []).map((h: { token: string; slot: string }) => `${h.token}|${new Date(h.slot).getTime()}`));
  const cache = new Map<string, string | null>();
  const always = new Set<string>([FEE_WALLET_ID]);
  for (const a of [BOT_WALLET_EVM, ...FUND_WALLETS.map((n) => fundWallet(n).address)]) {
    const id = await accountIdOf(a, cache);
    if (id) always.add(id);
  }
  const isContract = new Map<string, boolean>();
  let taken = 0;
  for (const tok of tokens) {
    for (const s of slots) {
      if (taken >= max) return taken;
      if (done.has(`${tok.address}|${s.t}`)) continue;
      const tokenId = tokenIdOf(tok.address);
      if (Date.parse(tok.created_at) > s.t) {
        await db.from("holdout_snapshots").insert({ token: tok.address, slot: new Date(s.t).toISOString(), period: s.period, skipped: true });
        continue;
      }
      const { data: prev } = await db.from("holdout_snapshots").select("lots").eq("token", tok.address).lt("slot", new Date(s.t).toISOString())
        .eq("skipped", false).order("slot", { ascending: false }).limit(1).maybeSingle();
      const prevLots = (prev?.lots ?? {}) as Record<string, Lot[]>;
      const excluded = new Set(always);
      excluded.add(tok.contract);
      const creator = await accountIdOf(tok.creator, cache);
      if (creator) excluded.add(creator);
      const info = await fetch(`${MIRROR_URL}/api/v1/tokens/${tokenId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (info?.treasury_account_id) excluded.add(info.treasury_account_id);
      const bals = await balancesAt(tokenId, s.t);
      const total = bals.reduce((a, b) => a + b.balance, 0n);
      const lots: Record<string, Lot[]> = {};
      const weights: Record<string, string> = {};
      let supply = 0n;
      for (const b of bals) {
        if (excluded.has(b.account)) continue;
        // Pools and other contracts holding a real share are not beneficial holders.
        if (total > 0n && b.balance * 200n >= total) {
          if (!isContract.has(b.account))
            isContract.set(b.account, (await fetch(`${MIRROR_URL}/api/v1/contracts/${b.account}`).catch(() => null))?.ok ?? false);
          if (isContract.get(b.account)) continue;
        }
        supply += b.balance;
        lots[b.account] = updateLots(prevLots[b.account] ?? [], b.balance, s.t);
        const w = lotWeight(lots[b.account] ?? [], s.t);
        if (w > 0n) weights[b.account] = w.toString();
      }
      const { error } = await db.from("holdout_snapshots").insert({
        token: tok.address, slot: new Date(s.t).toISOString(), period: s.period, supply: supply.toString(), lots, weights,
      });
      if (!error) taken++;
      break; // next slot of this coin on the next pass, so lots stay in order
    }
  }
  return taken;
}

async function feesByToken(db: Db, from: Date, to: Date, tokens: Set<string>) {
  const fees = new Map<string, bigint>();
  for (let off = 0; ; off += 1000) {
    const { data } = await db.from("trades").select("token,fee").eq("network", NETWORK)
      .gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).order("id").range(off, off + 999);
    for (const t of data ?? []) if (tokens.has(t.token)) fees.set(t.token, (fees.get(t.token) ?? 0n) + BigInt(Math.round(Number(t.fee) * 1e8)));
    if (!data || data.length < 1000) break;
  }
  return fees;
}

/** Pot for a week: Hold Out credits that week + last week's residual − that week's contest prize. */
export async function potFor(db: Db, start: Date) {
  const end = new Date(start.getTime() + 7 * DAY);
  const holdout = fundWallet("holdout").address.toLowerCase();
  const { data: credits } = await db.from("wallet_transfers").select("tinybars,recipient").eq("kind", "split").eq("status", "done")
    .gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  const credit = (credits ?? []).filter((c: { recipient: string }) => c.recipient.toLowerCase() === holdout)
    .reduce((a: bigint, c: { tinybars: string | number }) => a + BigInt(c.tinybars), 0n);
  const { data: last } = await db.from("holdout_periods").select("residual_tinybars").eq("period", periodKey(new Date(start.getTime() - 7 * DAY))).maybeSingle();
  const { data: prize } = await db.from("bot_payouts").select("hbar_amount,status").eq("id", `prize:${periodKey(start)}`).maybeSingle();
  const prizeT = prize && !["failed", "no_winner"].includes(prize.status) ? BigInt(Math.round(Number(prize.hbar_amount) * 1e8)) : 0n;
  const pot = credit + BigInt(last?.residual_tinybars ?? 0) - prizeT;
  return pot > 0n ? pot : 0n;
}

/** Splits a week's pot over coins by fees, then over holders by reward weight. */
export async function computePlan(db: Db, start: Date, pot: bigint) {
  const key = periodKey(start);
  const { data: snaps } = await db.from("holdout_snapshots").select("token,supply,weights,skipped").eq("period", key);
  const byToken = new Map<string, { supply: string; weights: Record<string, string> }[]>();
  for (const s of snaps ?? []) if (!s.skipped) byToken.set(s.token, [...(byToken.get(s.token) ?? []), s]);
  const fees = await feesByToken(db, start, new Date(start.getTime() + 7 * DAY), new Set(byToken.keys()));
  const coinPots = allocate(pot, fees);
  let residual = coinPots.residual;
  const perAccount = new Map<string, bigint>();
  const detail = new Map<string, Record<string, string>>();
  const coins: { token: string; fees: string; pot: string; holders: number }[] = [];
  for (const [token, coinPot] of coinPots.payouts) {
    const a = allocate(coinPot, rewardWeights(byToken.get(token) ?? []));
    residual += a.residual;
    coins.push({ token, fees: (fees.get(token) ?? 0n).toString(), pot: coinPot.toString(), holders: a.payouts.size });
    for (const [acc, p] of a.payouts) {
      perAccount.set(acc, (perAccount.get(acc) ?? 0n) + p);
      detail.set(acc, { ...(detail.get(acc) ?? {}), [token]: p.toString() });
    }
  }
  const { kept, rolled } = applyMinimum(perAccount);
  return { kept, detail, coins, residual: residual + rolled };
}

async function planFinishedPeriod(db: Db, now: number) {
  const start = new Date(periodStart(new Date(now)).getTime() - 7 * DAY);
  if (start.getTime() < Date.parse(HOLDOUT_START) || now < start.getTime() + 8 * DAY) return null;
  const key = periodKey(start);
  const { data: exists } = await db.from("holdout_periods").select("period").eq("period", key).maybeSingle();
  if (exists) return null;
  const w = fundWallet("holdout");
  const bal = (await mirrorAccount(w.address))?.tinybars ?? 0n;
  const { data: open } = await db.from("holdout_payouts").select("tinybars").in("status", ["planned", "pending"]);
  const owed = (open ?? []).reduce((a: bigint, r: { tinybars: string | number }) => a + BigInt(r.tinybars), 0n);
  let pot = await potFor(db, start);
  const cap = bal - WALLET_RESERVE - owed;
  if (pot > cap) pot = cap > 0n ? cap : 0n; // never plan more than the wallet holds
  const plan = await computePlan(db, start, pot);
  const planned = [...plan.kept.values()].reduce((a, b) => a + b, 0n);
  const { error } = await db.from("holdout_periods").insert({
    period: key, status: "planning", pot_tinybars: pot.toString(), planned_tinybars: planned.toString(),
    residual_tinybars: plan.residual.toString(), coins: plan.coins,
  });
  if (error) return null; // planned elsewhere
  const rows = [...plan.kept].map(([account, t]) => ({
    id: `${key}:${account}`, period: key, account, tinybars: t.toString(), coins: plan.detail.get(account) ?? {}, status: "planned",
  }));
  for (let i = 0; i < rows.length; i += 500)
    await db.from("holdout_payouts").upsert(rows.slice(i, i + 500), { onConflict: "id", ignoreDuplicates: true });
  await db.from("holdout_periods").update({ status: "ready" }).eq("period", key);
  return { period: key, payouts: rows.length };
}

async function sendPlanned(db: Db, max = 5) {
  const w = fundWallet("holdout");
  const { data: next } = await db.from("holdout_payouts").select("*").eq("status", "planned").order("created_at").limit(max);
  if (!next?.length) return 0;
  let bal = ((await mirrorAccount(w.address))?.tinybars ?? 0n) - WALLET_RESERVE;
  let nonce = await w.getNonce("latest");
  let sent = 0;
  for (const p of next) {
    const amt = BigInt(p.tinybars);
    if (amt > bal) break;
    const { data: claimed } = await db.from("holdout_payouts").update({ status: "pending" }).eq("id", p.id).eq("status", "planned").select("id");
    if (!claimed?.length) continue;
    try {
      const tx = await w.sendTransaction({ to: idToEvm(p.account), value: amt * WEI, gasLimit: 50_000n, nonce: nonce++, ...(await botFee(w)) });
      await db.from("holdout_payouts").update({ status: "sent", tx_hash: tx.hash }).eq("id", p.id);
      bal -= amt;
      sent++;
    } catch (e) {
      await db.from("holdout_payouts").update({ status: "unknown", error: String(e).slice(0, 300) }).eq("id", p.id);
      break;
    }
  }
  return sent;
}

/** One short step per scheduled call: confirm → snapshot → plan → send. */
export async function runHoldout() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
  const w = fundWallet("holdout");
  const { data: sent } = await db.from("holdout_payouts").select("id,tx_hash,created_at").eq("status", "sent").limit(10);
  for (const p of sent ?? []) {
    const rc = p.tx_hash ? await w.provider!.getTransactionReceipt(p.tx_hash).catch(() => null) : null;
    if (rc) await db.from("holdout_payouts").update({ status: rc.status === 1 ? "done" : "failed" }).eq("id", p.id);
    else if (Date.now() - new Date(p.created_at).getTime() > 15 * 60_000)
      await db.from("holdout_payouts").update({ status: "unknown", error: "no receipt" }).eq("id", p.id);
  }
  if (!(await mirrorAccount(w.address))) return { step: "wallet not created yet" };
  const now = Date.now();
  const snaps = await takeSnapshots(db, now);
  if (snaps) return { step: "snapshot", snaps };
  const plan = await planFinishedPeriod(db, now);
  if (plan) return { step: "planned", ...plan };
  return { step: "paid", sent: await sendPlanned(db) };
}
