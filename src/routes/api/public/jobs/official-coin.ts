import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/official-coin")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { createOfficialCoin } = await import("@/lib/official-coins.server");
        try {
          return Response.json(await createOfficialCoin());
        } catch (e) {
          console.error("official-coin", e);
          return Response.json({ error: "official coin failed" }, { status: 500 });
        }
      },
    },
  },
});
