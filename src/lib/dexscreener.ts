// DexScreener adapter helpers. Read-only views of on-chain data already synced from the mirror node.
// "Block" numbers are Unix seconds (Hedera has no EVM-style blocks); they are monotonic and stable.
export const HBAR_ASSET = "0x0000000000000000000000000000000000000000";
export const TOTAL_SUPPLY = 1_000_000_000;
// Constant product of the curve: starting virtual HBAR × starting virtual tokens.
const K = 20_000 * 1_073_000_000;

export const toBlock = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Curve reserves recovered from the trade price (k stays constant; fees are taken outside). */
export function reservesAt(price: number) {
  if (!(price > 0)) return { asset0: "0", asset1: "0" };
  return {
    asset0: Math.sqrt(K / price).toFixed(8),
    asset1: Math.sqrt(K * price).toFixed(8),
  };
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=5" },
  });

export const isAddr = (s: string | null): s is string => !!s && /^0x[0-9a-f]{40}$/.test(s);

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
