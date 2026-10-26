import { createFileRoute } from "@tanstack/react-router";
import { HBAR_ASSET, TOTAL_SUPPLY, assetMeta, db, isAddr, json } from "@/lib/dexscreener";

export const Route = createFileRoute("/api/public/dexscreener/asset")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id")?.toLowerCase() ?? null;
        if (id === HBAR_ASSET)
          return json({
            asset: { id, name: "HBAR", symbol: "HBAR", totalSupply: 50_000_000_000, coinGeckoId: "hedera-hashgraph" },
          });
        if (!isAddr(id)) return json({ error: "invalid id" }, 400);
        const { data: t } = await (await db())
          .from("tokens")
          .select("address,name,symbol,tokens_sold,image_url,website,twitter,telegram")
          .eq("address", id)
          .maybeSingle();
        if (!t) return json({ error: "not found" }, 404);
        return json({
          asset: {
            id: t.address,
            name: t.name,
            symbol: t.symbol,
            totalSupply: TOTAL_SUPPLY,
            circulatingSupply: Number(t.tokens_sold),
            ...assetMeta(t),
          },
        });
      },
    },
  },
});
