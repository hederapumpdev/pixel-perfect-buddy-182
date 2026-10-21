// Server-only: platform bot wallet that buys a fixed USD amount of every new coin.
// The key is derived from the BOT_SEED secret; the wallet only ever calls the launchpad.
import { ethers } from "ethers";
import {
  BOT_BUY_USD,
  BOT_START,
  EVM_CHAIN_ID,
  EVM_RPC_URL,
  GAS,
  GAS_V2,
  MIRROR_URL,
  NETWORK,
  PUMP_CONTRACTS,
} from "./hedera-config";
import { encodeBotBuy, isV2 } from "./curve";

const RESERVE_TINYBARS = 5n * 100_000_000n; // always keep 5 HBAR for gas
const WEI = 10_000_000_000n; // 1 tinybar = 1e10 weibar on JSON-RPC

export function botWallet() {
  const seed = process.env["BOT_SEED"];
  if (!seed) throw new Error("BOT_SEED missing");
  const provider = new ethers.JsonRpcProvider(EVM_RPC_URL, EVM_CHAIN_ID, { staticNetwork: true });
  return new ethers.Wallet(ethers.keccak256(ethers.toUtf8Bytes(seed)), provider);
}

const idToEvm = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

/** Hedera's relay rejects gas prices below its minimum; ethers' fee estimate sometimes returns ~0. */
export const MIN_GAS_PRICE_WEI = 1_100_000_000_000n;
export function safeGasPrice(reported: bigint | null | undefined): bigint {
  const withMargin = ((reported ?? 0n) * 12n) / 10n;
  return withMargin > MIN_GAS_PRICE_WEI ? withMargin : MIN_GAS_PRICE_WEI;
}
/** Legacy-type fee fields for bot transactions so a bad estimate never gets the tx rejected. */
export async function botFee(w: ethers.Wallet) {
  let reported: bigint | null = null;
  try {
    reported = BigInt(await (w.provider as ethers.JsonRpcProvider).send("eth_gasPrice", []));
  } catch {
    /* fall back to the minimum */
  }
  return { type: 0, gasPrice: safeGasPrice(reported) };
}

export async function botInfo() {
  const w = botWallet();
  const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${w.address}`);
  const j = r.ok ? await r.json() : null;
  return {
    address: w.address,
    accountId: (j?.account as string | undefined) ?? null,
    balanceHbar: j ? Number(j.balance?.balance ?? 0) / 1e8 : 0,
    usd: BOT_BUY_USD,
  };
}

async function usdToTinybars(usd: number) {
  const r = await fetch(`${MIRROR_URL}/api/v1/network/exchangerate`);
  const { current_rate: c } = await r.json();
  const usdPerHbar = c.cent_equivalent / c.hbar_equivalent / 100;
  return BigInt(Math.round((usd / usdPerHbar) * 1e8));
}

/** One step per call (at most one transaction sent), so it fits in a short scheduled request. */
export async function runAutobuy() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const w = botWallet();
  const { data: cfg } = await db.from("bot_settings").select("*").eq("id", 1).maybeSingle();
  const usd = Number(cfg?.usd_amount ?? BOT_BUY_USD);

  // 1) Advance a coin that is mid-way.
  const { data: open } = await db
    .from("bot_buys")
    .select("*")
    .in("status", ["assoc_sent", "buy_sent"])
    .order("created_at")
    .limit(1);
  const row = open?.[0];
  if (row) {
    const rc = row.tx_hash ? await w.provider!.getTransactionReceipt(row.tx_hash) : null;
    if (!rc) {
      if (Date.now() - new Date(row.created_at).getTime() > 15 * 60_000)
        await db.from("bot_buys").update({ status: "failed", error: "no receipt" }).eq("token", row.token);
      return { step: "waiting", token: row.token };
    }
    if (row.status === "buy_sent") {
      await db
        .from("bot_buys")
        .update({ status: rc.status === 1 ? "done" : "failed", error: rc.status === 1 ? null : "buy reverted" })
        .eq("token", row.token);
      return { step: "buy confirmed", token: row.token, ok: rc.status === 1 };
    }
    // associate done (a revert usually means it was already associated) → buy
    return sendBuy(db, w, row.token, usd);
  }

  // 2) Pick the next new coin (only while switched on in admin).
  if (cfg && !cfg.enabled) return { step: "off" };
  const { data: done } = await db.from("bot_buys").select("token");
  const seen = new Set((done ?? []).map((d) => d.token));
  const { data: coins } = await db
    .from("tokens")
    .select("address,contract")
    .eq("network", NETWORK)
    .eq("graduated", false)
    .in("contract", PUMP_CONTRACTS)
    .gte("created_at", BOT_START)
    .order("created_at")
    .limit(50);
  const next = (coins ?? []).find((c) => !seen.has(c.address));
  if (!next) return { step: "idle" };

  const { error } = await db.from("bot_buys").insert({ token: next.address, status: "pending" });
  if (error) return { step: "claimed elsewhere" }; // unique token: never bought twice

  if (isV2(next.contract)) {
    // Don't spend gas on associating while there isn't enough for the buy itself.
    const need = (await usdToTinybars(usd)) + RESERVE_TINYBARS;
    if ((await w.provider!.getBalance(w.address)) / WEI < need) {
      await db.from("bot_buys").delete().eq("token", next.address);
      return { step: "low balance" };
    }
    // HTS precompile associateToken(account, token)
    const data =
      "0x0914e2e2" + w.address.slice(2).toLowerCase().padStart(64, "0") + next.address.slice(2).padStart(64, "0");
    try {
      const tx = await w.sendTransaction({ to: "0x0000000000000000000000000000000000000167", data, gasLimit: 800_000n, ...(await botFee(w)) });
      await db.from("bot_buys").update({ status: "assoc_sent", tx_hash: tx.hash }).eq("token", next.address);
      return { step: "associate sent", token: next.address };
    } catch (e) {
      await db.from("bot_buys").update({ status: "failed", error: String(e).slice(0, 300) }).eq("token", next.address);
      return { step: "associate failed" };
    }
  }
  return sendBuy(db, w, next.address, usd);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendBuy(db: any, w: ethers.Wallet, token: string, usd: number) {
  const { data: t } = await db.from("tokens").select("contract,graduated").eq("address", token).maybeSingle();
  if (!t || t.graduated) {
    await db.from("bot_buys").update({ status: "skipped" }).eq("token", token);
    return { step: "skipped" };
  }
  const amount = await usdToTinybars(usd);
  const bal = (await w.provider!.getBalance(w.address)) / WEI;
  if (bal < amount + RESERVE_TINYBARS) {
    // Nothing sent: an already-associated coin keeps its row and buys once topped up;
    // a fresh coin is released so it is picked up again.
    const { data: row } = await db.from("bot_buys").select("status").eq("token", token).maybeSingle();
    if (row?.status !== "assoc_sent") await db.from("bot_buys").delete().eq("token", token);
    return { step: "low balance" };
  }
  const v2 = isV2(t.contract);
  try {
    const tx = await w.sendTransaction({
      to: idToEvm(t.contract),
      data: encodeBotBuy(t.contract, token),
      gasLimit: BigInt(v2 ? GAS_V2.buy : GAS.buy),
      value: amount * WEI,
      ...(await botFee(w)),
    });
    await db
      .from("bot_buys")
      .update({ status: "buy_sent", tx_hash: tx.hash, hbar_amount: Number(amount) / 1e8 })
      .eq("token", token);
    return { step: "buy sent", token };
  } catch (e) {
    await db.from("bot_buys").update({ status: "failed", error: String(e).slice(0, 300) }).eq("token", token);
    return { step: "buy failed" };
  }
}

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

/** Coins the bot bought that it still holds (read live from Hedera). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function botHoldings(db: any) {
  const w = botWallet();
  const { data: buys } = await db.from("bot_buys").select("token").in("status", ["buy_sent", "done"]).limit(200);
  const addrs = (buys ?? []).map((b: { token: string }) => b.token);
  if (!addrs.length) return [];
  const { data: tokens } = await db.from("tokens")
    .select("address,name,symbol,contract,graduated,virtual_hbar,virtual_tokens,tokens_sold").in("address", addrs);
  const { fromUnits, quoteSell, tokenUnit } = await import("./curve");
  const { data: trades } = await db.from("trades").select("token,is_buy,hbar_amount")
    .eq("trader", w.address.toLowerCase()).in("token", addrs).limit(5000);
  const spent = new Map<string, number>(), got = new Map<string, number>();
  for (const tr of trades ?? []) {
    const m = tr.is_buy ? spent : got;
    m.set(tr.token, (m.get(tr.token) ?? 0) + Number(tr.hbar_amount));
  }
  const out = [];
  for (const t of tokens ?? []) {
    let bal = 0n;
    try { bal = await new ethers.Contract(t.address, ERC20, w).getFunction("balanceOf")(w.address); } catch { continue; }
    const unit = tokenUnit(t.contract);
    const state = {
      virtualHbar: BigInt(Math.round(Number(t.virtual_hbar) * 1e8)),
      virtualTokens: BigInt(Math.round(Number(t.virtual_tokens))) * unit,
      tokensSold: BigInt(Math.round(Number(t.tokens_sold))) * unit,
    };
    out.push({
      address: t.address as string, name: t.name as string, symbol: t.symbol as string, graduated: !!t.graduated,
      tokens: fromUnits(bal, t.contract), hbarOut: t.graduated || bal <= 0n ? 0 : Number(quoteSell(state, bal).hbarOut) / 1e8,
      spent: spent.get(t.address) ?? 0, received: got.get(t.address) ?? 0,
    });
  }
  return out.map((c) => ({ ...c, profit: c.received + c.hbarOut - c.spent }));
}

/** Sells a % of the bot's coin back to the curve. One transaction per call: a one-time approval first, then the sale. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function botSell(db: any, token: string, pct: number) {
  const w = botWallet();
  const { data: t } = await db.from("tokens")
    .select("address,contract,graduated,virtual_hbar,virtual_tokens,tokens_sold").eq("address", token).maybeSingle();
  if (!t) throw new Error("Coin not found");
  if (t.graduated) throw new Error("This coin has graduated — sell it on SaucerSwap");
  const { encodePump, encodePumpV2, encodePumpV4, isV4, quoteSell, tokenUnit } = await import("./curve");
  const erc = new ethers.Contract(t.address, ERC20, w);
  const bal: bigint = await erc.getFunction("balanceOf")(w.address);
  const units = pct >= 100 ? bal : (bal * BigInt(Math.round(pct * 100))) / 10_000n;
  if (units <= 0n) throw new Error("The bot holds none of this coin");
  const spender = idToEvm(t.contract);
  const v2 = isV2(t.contract);
  const fee = await botFee(w);
  if (v2) {
    const allowed: bigint = await erc.getFunction("allowance")(w.address, spender);
    if (allowed < units) {
      const tx = await w.sendTransaction({
        to: t.address, data: erc.interface.encodeFunctionData("approve", [spender, bal * 2n]), gasLimit: 1_000_000n, ...fee,
      });
      await tx.wait();
      return { step: "approved", message: "One-time approval done — tap Sell again to sell." };
    }
  }
  const unit = tokenUnit(t.contract);
  const state = {
    virtualHbar: BigInt(Math.round(Number(t.virtual_hbar) * 1e8)),
    virtualTokens: BigInt(Math.round(Number(t.virtual_tokens))) * unit,
    tokensSold: BigInt(Math.round(Number(t.tokens_sold))) * unit,
  };
  const min = (quoteSell(state, units).hbarOut * 9_500n) / 10_000n; // 5% slippage
  const zero = "0x0000000000000000000000000000000000000000";
  const data = isV4(t.contract)
    ? encodePumpV4("sell", [t.address, units, min, zero])
    : v2 ? encodePumpV2("sell", [t.address, units, min]) : encodePump("sell", [t.address, units, min]);
  const tx = await w.sendTransaction({ to: spender, data, gasLimit: BigInt(v2 ? GAS_V2.sell : GAS.sell), ...fee });
  const r = await tx.wait();
  if (!r || r.status !== 1) throw new Error("Sale failed on Hedera");
  return { step: "sold", message: `Sold — tx ${tx.hash.slice(0, 12)}…`, hash: tx.hash };
}
