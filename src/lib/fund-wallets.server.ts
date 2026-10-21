// Server-only: the three site-managed fee wallets (split, team, Hold Out).
// Keys are derived from BOT_SEED with a per-wallet label, so no key is ever stored, logged
// or shown. Each account is created on Hedera by the bot's first HBAR deposit to its address.
import { ethers } from "ethers";
import { EVM_CHAIN_ID, EVM_RPC_URL, FEE_WALLET_EVM, MIRROR_URL, PUMP_CONTRACTS } from "./hedera-config";
import { encodePump } from "./curve";
import { botFee, botWallet } from "./bot.server";
import { splitAmounts } from "./holdout";

export type FundWalletName = "split" | "team" | "holdout";
export const FUND_WALLETS: FundWalletName[] = ["split", "team", "holdout"];

const WEI = 10_000_000_000n;
export const WALLET_RESERVE = 5n * 100_000_000n; // each wallet keeps 5 HBAR for gas
const FUND_AMOUNT = 5n * 100_000_000n + 50_000_000n; // initial deposit from the bot
const MIN_FORWARD = 100_000_000n; // only forward when ≥ 1 HBAR is spare

export function fundWallet(name: FundWalletName) {
  const seed = process.env["BOT_SEED"];
  if (!seed) throw new Error("BOT_SEED missing");
  const provider = new ethers.JsonRpcProvider(EVM_RPC_URL, EVM_CHAIN_ID, { staticNetwork: true });
  return new ethers.Wallet(ethers.keccak256(ethers.toUtf8Bytes(`${seed}:hederapump-fund-wallet:${name}`)), provider);
}

export const idToEvm = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

export async function mirrorAccount(addr: string) {
  const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${addr}`);
  if (!r.ok) return null;
  const j = await r.json();
  return { accountId: j.account as string, tinybars: BigInt(j.balance?.balance ?? 0) };
}

async function call(contract: string, fn: string) {
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: encodePump(fn), to: idToEvm(contract), estimate: false }),
  });
  return r.ok ? ((await r.json()).result as string) : "0x";
}

/** Owner, fee recipient and unclaimed platform fees per launchpad contract. */
export async function contractFeeStatus() {
  return Promise.all(
    PUMP_CONTRACTS.map(async (c) => {
      const [o, f, p] = await Promise.all([call(c, "owner"), call(c, "feeRecipient"), call(c, "platformFees")]);
      const addr = (h: string) => (h && h.length >= 66 ? "0x" + h.slice(-40) : null);
      return { contract: c, owner: addr(o), feeRecipient: addr(f), platformFees: p && p !== "0x" ? BigInt(p) : 0n };
    }),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Claims a transfer id, sends once, never resends. `nonce` lets several sends run back to back. */
export async function sendOnce(
  db: Db,
  w: ethers.Wallet,
  row: { id: string; kind: string; from_wallet: string; recipient: string; tinybars: bigint; data?: string },
  nonce?: number,
) {
  const { error } = await db.from("wallet_transfers").insert({
    id: row.id, kind: row.kind, from_wallet: row.from_wallet, recipient: row.recipient, tinybars: row.tinybars.toString(), status: "pending",
  });
  if (error) return { step: "claimed elsewhere", id: row.id };
  try {
    const tx = await w.sendTransaction({
      to: row.recipient,
      value: row.data ? 0n : row.tinybars * WEI,
      data: row.data,
      gasLimit: row.data ? 200_000n : 50_000n,
      ...(nonce === undefined ? {} : { nonce }),
      ...(await botFee(w)),
    });
    await db.from("wallet_transfers").update({ status: "sent", tx_hash: tx.hash }).eq("id", row.id);
    return { step: "sent", id: row.id };
  } catch (e) {
    // It may have reached the network: never retry automatically.
    await db.from("wallet_transfers").update({ status: "unknown", error: String(e).slice(0, 300) }).eq("id", row.id);
    return { step: "send error", id: row.id };
  }
}

/** Hourly: fund new wallets, collect contract fees, forward split balance 2/7 · 1/7 · 4/7. */
export async function runFeeSplit() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
  const split = fundWallet("split");

  // 1) Confirm sent transfers (receipts) — never resend.
  const { data: sent } = await db.from("wallet_transfers").select("*").eq("status", "sent").limit(5);
  for (const t of sent ?? []) {
    const rc = t.tx_hash ? await split.provider!.getTransactionReceipt(t.tx_hash).catch(() => null) : null;
    if (rc) await db.from("wallet_transfers").update({ status: rc.status === 1 ? "done" : "failed" }).eq("id", t.id);
    else if (Date.now() - new Date(t.created_at).getTime() > 15 * 60_000)
      await db.from("wallet_transfers").update({ status: "unknown", error: "no receipt" }).eq("id", t.id);
  }
  if ((sent ?? []).length) return { step: "confirming" };

  // 2) Create each wallet once with a bot deposit.
  for (const name of FUND_WALLETS) {
    const w = fundWallet(name);
    if (await mirrorAccount(w.address)) continue;
    const bot = botWallet();
    return sendOnce(db, bot, { id: `fund:${name}`, kind: "fund", from_wallet: bot.address, recipient: w.address, tinybars: FUND_AMOUNT });
  }

  const hour = new Date().toISOString().slice(0, 13);
  // 3) Collect platform fees held inside contracts that already point at the split wallet.
  for (const c of await contractFeeStatus()) {
    if (c.feeRecipient?.toLowerCase() !== split.address.toLowerCase() || c.platformFees <= 0n) continue;
    return sendOnce(db, split, {
      id: `claim:${c.contract}:${hour}`, kind: "claim", from_wallet: split.address, recipient: idToEvm(c.contract), tinybars: c.platformFees,
      data: encodePump("claimPlatformFees"),
    });
  }

  // 4) Forward what is above the reserve.
  const acc = await mirrorAccount(split.address);
  const spare = (acc?.tinybars ?? 0n) - WALLET_RESERVE;
  if (spare < MIN_FORWARD) return { step: "idle" };
  const a = splitAmounts(spare);
  const team = fundWallet("team").address;
  const holdout = fundWallet("holdout").address;
  let nonce = await split.getNonce("latest");
  const out = [];
  for (const [dest, to, amt] of [["team", team, a.team], ["holdout", holdout, a.holdout], ["platform", FEE_WALLET_EVM, a.platform]] as const) {
    if (amt <= 0n) continue;
    out.push(await sendOnce(db, split, { id: `split:${hour}:${dest}`, kind: "split", from_wallet: split.address, recipient: to, tinybars: amt }, nonce++));
  }

  // 5) Team wallet pays one staff member per run (staff earnings rules unchanged).
  const { autoPayStaff } = await import("./staff.functions");
  const staff = await autoPayStaff(db).catch((e) => ({ step: `staff error ${String(e).slice(0, 80)}` }));
  return { step: "forwarded", out, staff };
}

/** Admin view: the three wallets with their balances. */
export async function fundWalletsInfo() {
  return Promise.all(
    FUND_WALLETS.map(async (name) => {
      const w = fundWallet(name);
      const a = await mirrorAccount(w.address);
      return { name, address: w.address.toLowerCase(), accountId: a?.accountId ?? null, hbar: a ? Number(a.tinybars) / 1e8 : 0 };
    }),
  );
}
