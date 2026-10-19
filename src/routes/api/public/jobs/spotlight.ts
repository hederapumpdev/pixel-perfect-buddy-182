import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/spotlight")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { spotlightCoin } = await import("@/lib/promo.server");
        try {
          return Response.json(await spotlightCoin());
        } catch (e) {
          console.error("spotlight", e);
          return Response.json({ error: "spotlight failed" }, { status: 500 });
        }
      },
    },
  },
});
