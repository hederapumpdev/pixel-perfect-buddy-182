import { createFileRoute } from "@tanstack/react-router";
import { memoMatches, readTokenMemo, resolveCreatorAlias } from "@/lib/token-meta";

type TokenRow = {
  address: string; name: string; symbol: string; description: string | null;
  image_url: string | null; website: string | null; twitter: string | null; telegram: string | null;
};

async function listCreatorTokens(creator: string): Promise<TokenRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tokens")
    .select("address,name,symbol,description,image_url,website,twitter,telegram")
    .ilike("creator", creator)
    .order("created_at", { ascending: true })
    .range(0, 50);
  return data ?? [];
}

// The memo URL is immutable once a coin exists, and some memos were written with a
// long-zero creator address plus a per-contract index. When the plain creator+index
// lookup would hit a different coin, trust the memo itself: return the creator's token
// whose on-chain memo points at exactly this URL.
async function findToken(creator: string, index: number): Promise<TokenRow | null> {
  let tokens = await listCreatorTokens(creator);
  if (tokens.length === 0) {
    const alias = await resolveCreatorAlias(creator);
    if (alias) tokens = await listCreatorTokens(alias);
  }
  if (tokens.length === 0) return null;
  const byIndex = tokens[index] ?? null;
  if (tokens.length > 1) {
    for (const t of tokens) {
      const memo = await readTokenMemo(t.address);
      if (memo && memoMatches(memo, creator, index)) return t;
    }
  }
  return byIndex;
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

        let t = await findToken(creator, index);
        if (!t) {
          // The memo URL may use the creator's long-zero address while sync stored the alias.
          const alias = await resolveCreatorAlias(creator);
          if (alias) t = await findToken(alias, index);
        }
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
