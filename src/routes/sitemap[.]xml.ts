import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import { isSitemapRouteIncluded, sitemapPathForLocation, sitemapStaticPaths, sitemapXML, type SitemapEntry } from "@/lib/sitemap";
import { allSitemapTokens } from "@/lib/sitemap-tokens";
import { NETWORK } from "@/lib/hedera-config";

const BASE_URL = "https://hederapump.dev";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        try {
          const router = await getRouterInstance();
          const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path }));
          const routeId = "/token/$id";
          if (isSitemapRouteIncluded(router.routesById[routeId])) {
            const { createClient } = await import("@supabase/supabase-js");
            const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
            const url = process.env["SUPABASE_URL"];
            if (!key || !url) throw new Error("Public sitemap source unavailable");
            const db = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
              global: { fetch: (input, init) => {
                const headers = new Headers(init?.headers);
                if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
                headers.set("apikey", key);
                return fetch(input, { ...init, headers });
              } },
            });
            const tokens = await allSitemapTokens((offset, end) => db.from("tokens")
              .select("address").eq("network", NETWORK).order("address").range(offset, end));
            for (const token of tokens) {
              const location = router.buildLocation({ to: "/token/$id", params: { id: token.address }, search: () => ({}), hash: "" });
              const path = sitemapPathForLocation(router, location, routeId);
              if (path) entries.push({ path });
            }
          }
          if (!entries.length) return new Response("No public sitemap pages", { status: 404 });
          return new Response(sitemapXML(BASE_URL, entries), {
            headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
          });
        } catch {
          return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});