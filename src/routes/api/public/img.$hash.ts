import { createFileRoute } from "@tanstack/react-router";

// Serves coin images by content hash. Read-only; returns only stored image bytes.
export const Route = createFileRoute("/api/public/img/$hash")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[a-f0-9]{64}$/.test(params.hash)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("token_images")
          .select("mime,data")
          .eq("hash", params.hash)
          .maybeSingle();
        if (!data) return new Response("Not found", { status: 404 });
        const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          headers: {
            "content-type": data.mime,
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
