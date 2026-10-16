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
import { encodePump, encodePumpV2, isV2 } from "./curve";

const RESERVE_TINYBARS = 5n * 100_000_000n; // always keep 5 HBAR for gas
const WEI = 10_000_000_000n; // 1 tinybar = 1e10 weibar on JSON-RPC

export function botWallet() {
  const seed = process.env["BOT_SEED"];
  if (!seed) throw new Error("BOT_SEED missing");
  const provider = new ethers.JsonRpcProvider(EVM_RPC_URL, EVM_CHAIN_ID, { staticNetwork: true });
  return new ethers.Wallet(ethers.keccak256(ethers.toUtf8Bytes(seed)), provider);
}

const idToEvm = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

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
    return sendBuy(db, w, row.token);
  }

  // 2) Pick the next new coin.
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
    // HTS precompile associateToken(account, token)
    const data =
      "0x0914e2e2" + w.address.slice(2).toLowerCase().padStart(64, "0") + next.address.slice(2).padStart(64, "0");
    try {
      const tx = await w.sendTransaction({ to: "0x0000000000000000000000000000000000000167", data, gasLimit: 800_000n });
      await db.from("bot_buys").update({ status: "assoc_sent", tx_hash: tx.hash }).eq("token", next.address);
      return { step: "associate sent", token: next.address };
    } catch (e) {
      await db.from("bot_buys").update({ status: "failed", error: String(e).slice(0, 300) }).eq("token", next.address);
      return { step: "associate failed" };
    }
  }
  return sendBuy(db, w, next.address);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendBuy(db: any, w: ethers.Wallet, token: string) {
  const { data: t } = await db.from("tokens").select("contract,graduated").eq("address", token).maybeSingle();
  if (!t || t.graduated) {
    await db.from("bot_buys").update({ status: "skipped" }).eq("token", token);
    return { step: "skipped" };
  }
  const amount = await usdToTinybars(BOT_BUY_USD);
  const bal = (await w.provider!.getBalance(w.address)) / WEI;
  if (bal < amount + RESERVE_TINYBARS) {
    // Leave it pending-free so it is retried once the wallet is topped up.
    await db.from("bot_buys").delete().eq("token", token);
    return { step: "low balance" };
  }
  const v2 = isV2(t.contract);
  try {
    const tx = await w.sendTransaction({
      to: idToEvm(t.contract),
      data: (v2 ? encodePumpV2 : encodePump)("buy", [token, 0n]),
      gasLimit: BigInt(v2 ? GAS_V2.buy : GAS.buy),
      value: amount * WEI,
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
