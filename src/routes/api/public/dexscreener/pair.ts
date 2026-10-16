import { createFileRoute } from "@tanstack/react-router";
import { HBAR_ASSET, db, isAddr, json, toBlock } from "@/lib/dexscreener";

// Each coin's bonding curve is one pair: coin (asset0) / HBAR (asset1). Pair id = coin address.
export const Route = createFileRoute("/api/public/dexscreener/pair")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id")?.toLowerCase() ?? null;
        if (!isAddr(id)) return json({ error: "invalid id" }, 400);
        const { data: t } = await (await db())
          .from("tokens")
          .select("address,creator,created_at,created_tx")
          .eq("address", id)
          .maybeSingle();
        if (!t) return json({ error: "not found" }, 404);
        const b = toBlock(t.created_at);
        return json({
          pair: {
            id: t.address,
            dexKey: "hederapump",
            asset0Id: t.address,
            asset1Id: HBAR_ASSET,
            createdAtBlockNumber: b,
            createdAtBlockTimestamp: b,
            createdAtTxnId: t.created_tx ?? undefined,
            creator: t.creator,
            feeBps: 100,
          },
        });
      },
    },
  },
});
