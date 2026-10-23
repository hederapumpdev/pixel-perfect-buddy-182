import { createFileRoute } from "@tanstack/react-router";
import { resolveCreatorAlias } from "@/lib/token-meta";

async function findToken(creator: string, index: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tokens")
    .select("name,symbol,description,image_url,website,twitter,telegram")
    .ilike("creator", creator)
    .order("created_at", { ascending: true })
    .range(index, index);
  return data?.[0] ?? null;
}

// HIP-405 token metadata for v4 coins. The contract stores
// https://hederapump.dev/api/public/token-meta/<creatorEvm>/<index> on each token at
// creation (index = how many coins that creator had made before this one). SaucerSwap and
// wallets read this URL to show the coin's logo, description and links. Read-only.
export const Route = createFileRoute("/api/public/token-meta/$creator/$index")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params }) => {
        const creator = params.creator.toLowerCase();
        const index = Number(params.index);
        if (!/^0x[a-f0-9]{40}$/.test(creator) || !Number.isInteger(index) || index < 0 || index > 10_000)
          return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("tokens")
          .select("name,symbol,description,image_url,website,twitter,telegram")
          .ilike("creator", creator)
          .order("created_at", { ascending: true })
          .range(index, index);
        const t = data?.[0];
        if (!t) return new Response("Not found", { status: 404 });

        const body = {
          name: t.name,
          symbol: t.symbol,
          description: (t.description ?? "").slice(0, 1000),
          lightLogo: t.image_url ? `https://hederapump.dev/api/public/img/${t.image_url}` : undefined,
          website: t.website ?? "https://hederapump.dev",
          properties: {
            twitter: t.twitter?.replace(/^@/, "") || "hederapumpdev",
            telegram: t.telegram || "https://t.me/hederapump",
            category: "meme",
          },
        };
        return Response.json(body, {
          headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
        });
      },
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } }),
    },
  },
});
