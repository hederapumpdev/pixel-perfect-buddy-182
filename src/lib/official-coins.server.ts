// Server-only: creates clearly-labelled "Official" coins on a schedule, themed on
// memes trending on other chains. One creation transaction per scheduled call;
// the bot wallet is the creator, so every coin shows the "Official" badge.
import { GAS_V2, LATEST_CONTRACT_ID, MIRROR_URL, NETWORK } from "./hedera-config";
import { encodePumpV2, encodePumpV4, isV4 } from "./curve";
import { botWallet } from "./bot.server";
import { pickTrending, sanitizeTrending, type TrendingCandidate } from "./trending";
import { officialIceCatImage } from "./official-ice-cat-image";

const DAILY_CAP = 4;
const MIN_GAP_MS = 2 * 3_600_000;
const HTS_CREATE_BUDGET = 2_000_000_000n; // 20 HBAR, same as the create form
const WEI = 10_000_000_000n; // 1 tinybar = 1e10 weibar on JSON-RPC
const RESERVE_TINYBARS = 5n * 100_000_000n;

const idToEvm = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

/** Trending tokens on other chains, via DexScreener's public boosted-tokens list. */
async function trendingCandidates(): Promise<TrendingCandidate[]> {
  const r = await fetch("https://api.dexscreener.com/token-boosts/top/v1", { signal: AbortSignal.timeout(5_000) });
  if (!r.ok) return [];
  const boosts = (await r.json()) as { chainId?: string; tokenAddress?: string }[];
  const out: TrendingCandidate[] = [];
  for (const b of boosts.slice(0, 12)) {
    if (!b.tokenAddress) continue;
    try {
      const pr = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${b.tokenAddress}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!pr.ok) continue;
      const pj = (await pr.json()) as { pairs?: { baseToken?: { name?: string; symbol?: string } }[] };
      const c = sanitizeTrending({ name: pj.pairs?.[0]?.baseToken?.name, symbol: pj.pairs?.[0]?.baseToken?.symbol, chain: b.chainId });
      if (c) out.push(c);
    } catch {
      /* skip unreachable token */
    }
  }
  return out;
}

async function creationFee(contractId: string): Promise<bigint> {
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: encodePumpV2("creationFee"), to: idToEvm(contractId), estimate: false }),
  });
  const j = await r.json();
  return BigInt(j.result ?? "0x0");
}

export async function createOfficialCoin(now = new Date(), replacement = false) {
  if (!LATEST_CONTRACT_ID) return { step: "no contract" };
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { data: today, error } = await db.from("official_coins").select("id").gte("created_at", dayStart);
  if (error) throw error;
  if ((today ?? []).length >= DAILY_CAP) return { step: "daily cap reached" };
  const { data: last } = await db.from("official_coins").select("created_at").order("created_at", { ascending: false }).limit(1);
  if (!replacement && last?.[0] && now.getTime() - new Date(last[0].created_at).getTime() < MIN_GAP_MS) return { step: "too soon" };
  if (!replacement && Math.random() < 0.5) return { step: "skipped this hour" }; // irregular times, not on the dot

  const candidates = replacement
    ? [{ name: "Hedera Ice Cat", symbol: "HICECAT", chain: "solana" }]
    : await trendingCandidates();
  if (!candidates.length) return { step: "no trending data" };
  const { data: existing } = await db.from("tokens").select("name,symbol").eq("network", NETWORK);
  const taken = new Set((existing ?? []).flatMap((t) => [String(t.name).toLowerCase(), String(t.symbol).toLowerCase()]));
  const pick = pickTrending(candidates, taken);
  if (!pick) return { step: "nothing new to theme on" };

  // Persist the original team mascot before paying; the chain event carries its hash.
  const bytes = Uint8Array.from(atob(officialIceCatImage), (c) => c.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const image = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error: imageError } = await db.from("token_images").upsert(
    { hash: image, mime: "image/jpeg", data: officialIceCatImage },
    { onConflict: "hash", ignoreDuplicates: true },
  );
  if (imageError) throw imageError;

  const id = pick.symbol.toLowerCase();
  const { error: claimError } = await db.from("official_coins").insert({ id, name: pick.name, symbol: pick.symbol });
  if (claimError) return { step: claimError.code === "23505" ? "claimed elsewhere" : "claim failed" };

  const w = botWallet();
  const creator = w.address.toLowerCase();
  try {
    const fee = await creationFee(LATEST_CONTRACT_ID);
    if (!w.provider) throw new Error("Bot provider unavailable");
    const bal = (await w.provider.getBalance(w.address)) / WEI;
    if (bal < fee + HTS_CREATE_BUDGET + RESERVE_TINYBARS) {
      // Free the claim so it is retried once the wallet is topped up.
      await db.from("official_coins").delete().eq("id", id);
      return { step: "low balance" };
    }
    const { count } = await db.from("tokens").select("address", { count: "exact", head: true }).ilike("creator", creator);
    const metadataUrl = `https://hederapump.dev/api/public/token-meta/${creator}/${count ?? 0}`;
    const meta = JSON.stringify({
      description: replacement
        ? "Official HederaPump replacement for our image-less CATONICE test launch. Original team mascot, inspired by cat memes trending on Solana; not affiliated with other tokens."
        : `Official HederaPump coin inspired by $${pick.symbol}, trending on ${pick.chain}. Original team mascot; not affiliated with the original token.`,
      image,
      website: "https://hederapump.dev",
    });
    const calldata = isV4(LATEST_CONTRACT_ID)
      ? encodePumpV4("createToken", [pick.name, pick.symbol, meta, metadataUrl, 0n])
      : encodePumpV2("createToken", [pick.name, pick.symbol, meta, 0n]);
    const tx = await w.sendTransaction({
      to: idToEvm(LATEST_CONTRACT_ID),
      data: calldata,
      gasLimit: BigInt(GAS_V2.create),
      value: (fee + HTS_CREATE_BUDGET) * WEI,
    });
    await db.from("official_coins").update({ status: "sent", tx_hash: tx.hash }).eq("id", id);
    return { step: "creation sent", symbol: pick.symbol };
  } catch (e) {
    await db
      .from("official_coins")
      .update({ status: "failed", last_error: String(e).slice(0, 300) })
      .eq("id", id);
    return { step: "creation failed" };
  }
}
