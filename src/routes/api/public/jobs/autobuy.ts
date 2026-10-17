import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/autobuy")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runAutobuy } = await import("@/lib/bot.server");
        try {
          return Response.json(await runAutobuy());
        } catch (e) {
          console.error("autobuy", e);
          return Response.json({ error: "autobuy failed" }, { status: 500 });
        }
      },
    },
  },
});
