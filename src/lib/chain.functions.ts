import { createServerFn } from "@tanstack/react-start";
import { decodeEventLog, type Hex } from "viem";
import artifact from "./contract-artifact.json";
import { MIRROR_URL, NETWORK, PUMP_CONTRACT_ID } from "./hedera-config";

const abi = artifact.pumpAbi as never;

type MirrorLog = {
  data: Hex;
  topics: Hex[];
  timestamp: string;
  transaction_hash: string;
  index: number;
};

/**
 * Pulls new launchpad events from the public Hedera mirror node and stores them.
 * Only writes data derived from on-chain events, so it is safe to expose publicly.
 */
export const syncChain = createServerFn({ method: "POST" }).handler(async () => {
  if (!PUMP_CONTRACT_ID) return { synced: 0, configured: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: st } = await supabaseAdmin
    .from("sync_state")
    .select("*")
    .eq("contract", PUMP_CONTRACT_ID)
    .maybeSingle();
  if (st && Date.now() - new Date(st.synced_at).getTime() < 4000)
    return { synced: 0, configured: true };
  let last = st?.last_timestamp ?? "0";
  await supabaseAdmin
    .from("sync_state")
    .upsert({
      contract: PUMP_CONTRACT_ID,
      last_timestamp: last,
      synced_at: new Date().toISOString(),
    });

  let count = 0;
  for (let page = 0; page < 5; page++) {
    const res = await fetch(
      `${MIRROR_URL}/api/v1/contracts/${PUMP_CONTRACT_ID}/results/logs?order=asc&limit=100&timestamp=gt:${last}`,
    );
    if (!res.ok) {
      console.error("mirror error", res.status);
      break;
    }
    const { logs } = (await res.json()) as { logs: MirrorLog[] };
    if (!logs?.length) break;
    for (const log of logs) {
      await handleLog(supabaseAdmin, log);
      last = log.timestamp;
      count++;
    }
    await supabaseAdmin
      .from("sync_state")
      .update({ last_timestamp: last })
      .eq("contract", PUMP_CONTRACT_ID);
    if (logs.length < 100) break;
  }
  return { synced: count, configured: true };
});

const tsToIso = (ts: string) =>
  new Date(
    Number(ts.split(".")[0]) * 1000 + Number((ts.split(".")[1] ?? "0").slice(0, 3)),
  ).toISOString();
const hbar = (v: bigint) => Number(v) / 1e8;
const tok = (v: bigint) => Number(v / 10n ** 10n) / 1e8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleLog(db: any, log: MirrorLog) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ev: { eventName: string; args: any };
  try {
    ev = decodeEventLog({ abi, data: log.data, topics: log.topics as [Hex, ...Hex[]] }) as never;
  } catch {
    return;
  }
  const a = ev.args;
  if (ev.eventName === "TokenCreated") {
    let meta: Record<string, string> = {};
    try {
      meta = JSON.parse(String(a.metadata));
    } catch {
      /* ignore */
    }
    const s = (k: string, n = 300) => (typeof meta[k] === "string" ? meta[k].slice(0, n) : null);
    const img = s("image", 80);
    await db.from("tokens").upsert(
      {
        address: String(a.token).toLowerCase(),
        network: NETWORK,
        creator: String(a.creator).toLowerCase(),
        name: String(a.name).slice(0, 32),
        symbol: String(a.symbol).slice(0, 10),
        description: s("description", 500),
        image_url: img && /^[a-f0-9]{64}$/.test(img) ? img : null,
        website: s("website"),
        twitter: s("twitter"),
        telegram: s("telegram"),
        virtual_hbar: 0,
        virtual_tokens: 0,
        created_tx: log.transaction_hash,
        created_at: tsToIso(log.timestamp),
      },
      { onConflict: "address", ignoreDuplicates: true },
    );
  } else if (ev.eventName === "Trade") {
    const token = String(a.token).toLowerCase();
    const vH = hbar(a.virtualHbar as bigint),
      vT = tok(a.virtualTokens as bigint);
    const id = `${log.transaction_hash}-${log.index}`;
    const { error } = await db.from("trades").insert({
      id,
      network: NETWORK,
      token,
      trader: String(a.trader).toLowerCase(),
      is_buy: Boolean(a.isBuy),
      hbar_amount: hbar(a.hbarAmount as bigint),
      token_amount: tok(a.tokenAmount as bigint),
      fee: hbar(a.fee as bigint),
      price: vT ? vH / vT : 0,
      tx_hash: log.transaction_hash,
      created_at: tsToIso(log.timestamp),
    });
    if (error) return; // duplicate
    const { data: t } = await db
      .from("tokens")
      .select("volume_hbar,trade_count")
      .eq("address", token)
      .maybeSingle();
    if (!t) return;
    await db
      .from("tokens")
      .update({
        virtual_hbar: vH,
        virtual_tokens: vT,
        tokens_sold: 1_073_000_000 - vT,
        volume_hbar: Number(t.volume_hbar) + hbar(a.hbarAmount as bigint),
        trade_count: t.trade_count + 1,
        last_trade_at: tsToIso(log.timestamp),
      })
      .eq("address", token);
  } else if (ev.eventName === "Graduated") {
    await db
      .from("tokens")
      .update({ graduated: true })
      .eq("address", String(a.token).toLowerCase());
  }
}

const MAX_IMG = 400_000;

/** Stores a coin image (≤400 KB) and returns its content hash, used in on-chain metadata. */
export const uploadImage = createServerFn({ method: "POST" })
  .inputValidator((d: { mime: string; base64: string }) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(d.mime))
      throw new Error("Unsupported image type");
    if (typeof d.base64 !== "string" || d.base64.length > (MAX_IMG * 4) / 3 + 8)
      throw new Error("Image too large (max 400 KB)");
    return d;
  })
  .handler(async ({ data }) => {
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("token_images")
      .upsert(
        { hash, mime: data.mime, data: data.base64 },
        { onConflict: "hash", ignoreDuplicates: true },
      );
    return { hash };
  });
