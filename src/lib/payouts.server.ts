// Server-only: the Hold Out wallet pays the weekly contest prize; the bot refunds creation fees.
// One transaction per call; each payout has a unique id so nothing is ever paid twice.
import { MIRROR_URL, NETWORK, PUMP_CONTRACTS } from "./hedera-config";
import { encodePump, encodePumpV2, isV2 } from "./curve";
import { botFee, botWallet } from "./bot.server";
import {
  CONTEST_PRIZE_HBAR,
  FREE_COIN_LIMIT,
  PROMO_START,
  contestLeaderboard,
  contestWinner,
  isOfficial,
  weekKey,
  weekStart,
} from "./promotions";

const WEI = 10_000_000_000n;
const RESERVE = 5n * 100_000_000n;
const idToEvm = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

async function creationFee(contract: string): Promise<bigint> {
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: (isV2(contract) ? encodePumpV2 : encodePump)("creationFee"), to: idToEvm(contract), estimate: false }),
  });
  return BigInt((await r.json()).result ?? "0x0");
}

export async function runPayouts() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const w = botWallet();

  // 1) Confirm a payout already sent. Never resend: an unclear one stays "unknown".
  const { data: sent } = await db.from("bot_payouts").select("*").eq("status", "sent").limit(1);
  if (sent?.[0]) {
    const p = sent[0];
    const rc = p.tx_hash ? await w.provider!.getTransactionReceipt(p.tx_hash) : null;
    if (!rc) {
      if (Date.now() - new Date(p.created_at).getTime() > 15 * 60_000)
        await db.from("bot_payouts").update({ status: "unknown", error: "no receipt" }).eq("id", p.id);
      return { step: "waiting", id: p.id };
    }
    await db.from("bot_payouts").update({ status: rc.status === 1 ? "done" : "failed" }).eq("id", p.id);
    return { step: "confirmed", id: p.id };
  }
  const { data: cfg } = await db.from("bot_settings").select("enabled").eq("id", 1).maybeSingle();
  if (cfg && !cfg.enabled) return { step: "off" };

  const { data: tokens } = await db.from("tokens").select("address,creator,contract,created_at").eq("network", NETWORK);
  const creatorOf = new Map((tokens ?? []).map((t) => [t.address, t.creator]));

  // 2) Last week's contest prize.
  const thisWeek = weekStart(new Date());
  const lastWeek = new Date(thisWeek.getTime() - 7 * 86_400_000);
  const prizeId = `prize:${weekKey(lastWeek)}`;
  const { data: prizeRow } = await db.from("bot_payouts").select("id").eq("id", prizeId).maybeSingle();
  if (!prizeRow && lastWeek.toISOString() >= weekStart(new Date(PROMO_START)).toISOString()) {
    const trades: { token: string; hbar_amount: number; created_at: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await db
        .from("trades")
        .select("token,hbar_amount,created_at")
        .eq("network", NETWORK)
        .gte("created_at", lastWeek.toISOString())
        .lt("created_at", thisWeek.toISOString())
        .range(from, from + 999);
      trades.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const win = contestWinner(contestLeaderboard(trades, (t) => creatorOf.get(t), lastWeek, thisWeek));
    if (!win) {
      await db.from("bot_payouts").insert({ id: prizeId, kind: "prize", recipient: "-", status: "no_winner" });
      return { step: "no winner" };
    }
    // The weekly contest prize now comes from the Hold Out wallet.
    const { fundWallet } = await import("./fund-wallets.server");
    return pay(db, fundWallet("holdout") as never, { id: prizeId, kind: "prize", recipient: creatorOf.get(win.token)!, token: win.token }, BigInt(CONTEST_PRIZE_HBAR) * 100_000_000n);
  }

  // 3) Free first coin for the first FREE_COIN_LIMIT new creators.
  const { count } = await db.from("bot_payouts").select("id", { count: "exact", head: true }).eq("kind", "refund");
  if ((count ?? 0) >= FREE_COIN_LIMIT) return { step: "idle" };
  const { data: refunded } = await db.from("bot_payouts").select("recipient").eq("kind", "refund");
  const done = new Set((refunded ?? []).map((r) => r.recipient.toLowerCase()));
  const firstCoin = new Map<string, string>();
  for (const t of [...(tokens ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const c = t.creator.toLowerCase();
    if (!firstCoin.has(c)) firstCoin.set(c, t.created_at);
  }
  const next = [...(tokens ?? [])]
    .filter((t) => PUMP_CONTRACTS.includes(t.contract) && t.created_at >= PROMO_START && !isOfficial(t.creator))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .find((t) => !done.has(t.creator.toLowerCase()) && firstCoin.get(t.creator.toLowerCase()) === t.created_at);
  if (!next) return { step: "idle" };
  const fee = await creationFee(next.contract);
  if (fee <= 0n) return { step: "no fee" };
  return pay(db, w, { id: `refund:${next.creator.toLowerCase()}`, kind: "refund", recipient: next.creator, token: next.address }, fee);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pay(db: any, w: ReturnType<typeof botWallet>, row: { id: string; kind: string; recipient: string; token: string }, tinybars: bigint) {
  const bal = (await w.provider!.getBalance(w.address)) / WEI;
  if (bal < tinybars + RESERVE) return { step: "low balance", id: row.id };
  const { error } = await db.from("bot_payouts").insert({ ...row, hbar_amount: Number(tinybars) / 1e8, status: "pending" });
  if (error) return { step: "claimed elsewhere" };
  try {
    const tx = await w.sendTransaction({ to: row.recipient, value: tinybars * WEI, gasLimit: 50_000n, ...(await botFee(w)) });
    await db.from("bot_payouts").update({ status: "sent", tx_hash: tx.hash }).eq("id", row.id);
    return { step: "sent", id: row.id };
  } catch (e) {
    // Might have reached the network: never retry automatically.
    await db.from("bot_payouts").update({ status: "unknown", error: String(e).slice(0, 300) }).eq("id", row.id);
    return { step: "send error", id: row.id };
  }
}
