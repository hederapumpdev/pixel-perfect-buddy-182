import { createFileRoute } from "@tanstack/react-router";
import { db, json, reservesAt, toBlock } from "@/lib/dexscreener";
import { NETWORK } from "@/lib/hedera-config";

export const Route = createFileRoute("/api/public/dexscreener/events")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const from = Number(q.get("fromBlock")),
          to = Number(q.get("toBlock"));
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from)
          return json({ error: "invalid range" }, 400);
        const { data, error } = await (await db())
          .from("trades")
          .select("id,token,trader,is_buy,hbar_amount,token_amount,price,tx_hash,created_at")
          .eq("network", NETWORK)
          .gte("created_at", new Date(from * 1000).toISOString())
          .lt("created_at", new Date((to + 1) * 1000).toISOString())
          .order("created_at", { ascending: true })
          .limit(5000);
        if (error) return json({ error: "unavailable" }, 503);
        const events = (data ?? []).map((r) => {
          const b = toBlock(r.created_at);
          const ev = Number(r.id.split("-").pop() ?? 0);
          const tok = Number(r.token_amount).toFixed(8),
            hb = Number(r.hbar_amount).toFixed(8);
          return {
            block: { blockNumber: b, blockTimestamp: b },
            eventType: "swap",
            txnId: r.tx_hash,
            txnIndex: 0,
            eventIndex: ev,
            maker: r.trader,
            pairId: r.token,
            ...(r.is_buy ? { asset1In: hb, asset0Out: tok } : { asset0In: tok, asset1Out: hb }),
            priceNative: String(r.price),
            reserves: reservesAt(Number(r.price)),
          };
        });
        return json({ events });
      },
    },
  },
});
