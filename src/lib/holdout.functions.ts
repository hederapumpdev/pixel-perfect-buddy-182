import { createServerFn } from "@tanstack/react-start";
import { MIRROR_URL } from "./hedera-config";
import { allocate, periodKey, periodStart, rewardWeights } from "./holdout";

const s = (v: bigint) => v.toString();

/** Public: this week's estimated pot per coin, recent weeks and payouts (on-chain data only). */
export const getHoldoutOverview = createServerFn({ method: "GET" }).handler(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
  const { computePlan, potFor } = await import("./holdout.server");
  const start = periodStart(new Date());
  const pot = await potFor(db, start).catch(() => 0n);
  const plan = await computePlan(db, start, pot).catch(() => null);
  const { data: periods } = await db.from("holdout_periods").select("period,status,pot_tinybars,planned_tinybars,residual_tinybars,coins")
    .order("period", { ascending: false }).limit(8);
  const { data: payouts } = await db.from("holdout_payouts").select("period,account,tinybars,status,tx_hash")
    .order("created_at", { ascending: false }).limit(30);
  return {
    period: periodKey(start),
    pot: s(pot),
    coins: (plan?.coins ?? []).sort((a, b) => Number(BigInt(b.pot) - BigInt(a.pot))),
    periods: periods ?? [],
    payouts: payouts ?? [],
  };
});

/** Public: estimated reward this week and payout history for one wallet. Estimates only. */
export const getHoldoutEstimate = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string }) => {
    const w = String(d.wallet ?? "").trim().toLowerCase();
    if (!/^0\.0\.\d+$/.test(w) && !/^0x[0-9a-f]{40}$/.test(w)) throw new Error("Bad wallet");
    return { wallet: w };
  })
  .handler(async ({ data }) => {
    let account = data.wallet;
    if (!/^0\.0\.\d+$/.test(account)) {
      const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${account}`);
      account = r.ok ? (await r.json()).account : "";
    }
    if (!account) return { account: null, estimate: "0", coins: {}, history: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { computePlan, potFor } = await import("./holdout.server");
    const start = periodStart(new Date());
    const pot = await potFor(db, start).catch(() => 0n);
    const plan = await computePlan(db, start, pot).catch(() => null);
    // Show the raw share even when it would fall under the minimum payout this week.
    const coins: Record<string, string> = {};
    let est = 0n;
    if (plan) {
      const { data: snaps } = await db.from("holdout_snapshots").select("token,supply,weights,skipped").eq("period", periodKey(start));
      for (const c of plan.coins) {
        const own = (snaps ?? []).filter((x: { token: string; skipped: boolean }) => x.token === c.token && !x.skipped);
        const p = allocate(BigInt(c.pot), rewardWeights(own)).payouts.get(account) ?? 0n;
        if (p > 0n) { coins[c.token] = s(p); est += p; }
      }
    }
    const { data: history } = await db.from("holdout_payouts").select("period,tinybars,status,tx_hash").eq("account", account)
      .order("period", { ascending: false }).limit(20);
    return { account, estimate: s(est), coins, history: history ?? [] };
  });

/** Admin: the three fee wallets, contract fee recipients and recent transfers. */
export const getFundWalletsAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => ({ pin: String(d.pin ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    await (await import("./admin-auth.server")).requireAdmin(data.pin);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { contractFeeStatus, fundWalletsInfo, isSplitRecipient } = await import("./fund-wallets.server");
    const [wallets, contracts] = await Promise.all([fundWalletsInfo(), contractFeeStatus()]);
    const splitWallet = wallets.find((x) => x.name === "split");
    const { data: transfers } = await db.from("wallet_transfers").select("*").neq("tinybars", 0)
      .order("created_at", { ascending: false }).limit(20);
    const { data: payouts } = await db.from("holdout_payouts").select("id,account,tinybars,status,tx_hash,created_at")
      .order("created_at", { ascending: false }).limit(20);
    const { data: staff } = await db.from("bot_payouts").select("id,recipient,hbar_amount,status,created_at").eq("kind", "staff")
      .order("created_at", { ascending: false }).limit(10);
    const { data: periods } = await db.from("holdout_periods").select("period,status,pot_tinybars,planned_tinybars,residual_tinybars,coins")
      .order("period", { ascending: false }).limit(8);
    const { data: snaps } = await db.from("holdout_snapshots").select("period,slot,skipped").order("slot", { ascending: false }).limit(500);
    const snapshots: Record<string, { slots: number; coins: number }> = {};
    const seen = new Set<string>();
    for (const r of snaps ?? []) {
      const e = (snapshots[r.period] ??= { slots: 0, coins: 0 });
      e.coins++;
      const k = `${r.period}|${r.slot}`;
      if (!seen.has(k)) { seen.add(k); e.slots++; }
    }
    return {
      wallets,
      contracts: contracts.map((c) => ({ ...c, platformFees: s(c.platformFees) })),
      transfers: transfers ?? [],
      payouts: payouts ?? [],
      staff: staff ?? [],
      periods: (periods ?? []).map((p: { coins: unknown[] }) => ({ ...p, coinCount: Array.isArray(p.coins) ? p.coins.length : 0, coins: undefined })),
      snapshots,
    };
  });
