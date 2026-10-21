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
  // The bot wallet itself receives all platform fees and forwards them.
  if (name === "split") return botWallet();
  const seed = process.env["BOT_SEED"];
  if (!seed) throw new Error("BOT_SEED missing");
  const provider = new ethers.JsonRpcProvider(EVM_RPC_URL, EVM_CHAIN_ID, { staticNetwork: true });
  return new ethers.Wallet(ethers.keccak256(ethers.toUtf8Bytes(`${seed}:hederapump-fund-wallet:${name}`)), provider);
}

/** The public key a wallet needs to open this account on Hedera. The key itself never leaves the server. */
export function fundWalletPublicKey(name: FundWalletName) {
  return fundWallet(name).signingKey.compressedPublicKey;
}

/**
 * A deposit whose receipt says "reverted" is known not to have arrived, so the next attempt may
 * use a fresh id. A deposit whose result is still unknown is never resent.
 */
async function fundAttempt(db: Db, name: FundWalletName) {
  const { data } = await db
    .from("wallet_transfers")
    .select("id,status")
    .eq("kind", "fund")
    .like("id", `fund:${name}:%`);
  const rows = (data ?? []) as { id: string; status: string }[];
  if (rows.some((r) => r.status === "pending" || r.status === "unknown")) return null;
  const used = new Set(rows.map((r) => r.id));
  let n = 3; // v1 and v2 predate the account-creation step
  while (used.has(`fund:${name}:v${n}`)) n++;
  return `fund:${name}:v${n}`;
}

/**
 * Records every fee HBAR the bot received from a launchpad contract during someone else's
 * transaction (per-trade fee pushes). The bot's own buys/sells are excluded so its trading
 * budget is never forwarded. Unique `fee:<timestamp>` ids make each inflow count once.
 */
async function recordFeeInflows(db: Db, botId: string) {
  const { data: last } = await db.from("wallet_transfers").select("tx_hash").eq("kind", "fee_in").order("tx_hash", { ascending: false }).limit(1);
  const since = last?.[0]?.tx_hash as string | undefined;
  if (!since) {
    // Start counting from now; nothing earlier is treated as fee money.
    const now = (Date.now() / 1000).toFixed(9);
    await db.from("wallet_transfers").insert({ id: "fee:start", kind: "fee_in", from_wallet: "-", recipient: botId, tinybars: "0", status: "done", tx_hash: now });
    return;
  }
  const r = await fetch(`${MIRROR_URL}/api/v1/transactions?account.id=${botId}&timestamp=gt:${since}&order=asc&limit=100`);
  if (!r.ok) return;
  const j = await r.json();
  const contracts = new Set(PUMP_CONTRACTS);
  for (const t of j.transactions ?? []) {
    if (t.result !== "SUCCESS") continue;
    const payer = String(t.transaction_id ?? "").split("-")[0];
    const transfers = (t.transfers ?? []) as { account: string; amount: number }[];
    const fromContract = transfers.some((x) => contracts.has(x.account) && x.amount < 0);
    const credit = transfers.filter((x) => x.account === botId).reduce((s, x) => s + BigInt(x.amount), 0n);
    const amount = payer !== botId && fromContract && credit > 0n ? credit : 0n;
    await db.from("wallet_transfers").insert({
      id: `fee:${t.consensus_timestamp}`, kind: "fee_in", from_wallet: payer, recipient: botId, tinybars: amount.toString(), status: "done", tx_hash: t.consensus_timestamp,
    });
  }
}

/** Fee HBAR received (pushes + completed contract claims, kind "claim") minus what was already forwarded. */
async function unforwardedFees(db: Db, bot: string) {
  const { data } = await db.from("wallet_transfers").select("kind,tinybars,status,from_wallet").in("kind", ["fee_in", "claim", "split"]);
  let total = 0n;
  for (const t of data ?? []) {
    const v = BigInt(t.tinybars ?? 0);
    if (t.kind === "split" && t.from_wallet?.toLowerCase() === bot.toLowerCase()) total -= v; // any status: never forward twice
    else if (t.kind !== "split" && t.status === "done") total += v;
  }
  return total;
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
  row: { id: string; kind: string; from_wallet: string; recipient: string; tinybars: bigint; data?: string; gas?: bigint },
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
      ...(row.data ? { data: row.data } : {}),
      gasLimit: row.data ? 200_000n : row.kind === "fund" ? 600_000n : 50_000n, // opening a new account needs extra gas
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

  // 2) Give each opened wallet its one-time starting deposit (gas for its own payouts).
  for (const name of FUND_WALLETS) {
    if (name === "split") continue; // the bot wallet funds the others
    const w = fundWallet(name);
    const acc = await mirrorAccount(w.address);
    // Hedera needs a real account before an address can hold HBAR: wait until it is opened in admin.
    if (!acc) continue;
    const { data: done } = await db.from("wallet_transfers").select("id").eq("kind", "fund").like("id", `fund:${name}:%`).eq("status", "done").limit(1);
    if (!needsStartDeposit(acc.tinybars, (done ?? []).length > 0)) continue;
    // Nothing is paid twice: each attempt claims its own id, only a confirmed revert gets a new one.
    const id = await fundAttempt(db, name);
    if (!id) return { step: `funding ${name} is uncertain` };
    const bot = botWallet();
    return sendOnce(db, bot, { id, kind: "fund", from_wallet: bot.address, recipient: w.address, tinybars: FUND_AMOUNT, gas: 50_000n });
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

  // 4) Forward only received fee money — never the bot's own buy budget or reserve.
  const acc = await mirrorAccount(split.address);
  if (!acc) return { step: "idle" };
  await recordFeeInflows(db, acc.accountId);
  const fees = await unforwardedFees(db, split.address);
  const room = acc.tinybars - WALLET_RESERVE;
  const spare = fees < room ? fees : room;
  if (spare < MIN_FORWARD) return { step: "idle", fees: fees.toString() };
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
      return { name, address: w.address.toLowerCase(), publicKey: w.signingKey.compressedPublicKey, accountId: a?.accountId ?? null, hbar: a ? Number(a.tinybars) / 1e8 : 0 };
    }),
  );
}
