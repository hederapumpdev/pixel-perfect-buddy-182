import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/holdout")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runHoldout } = await import("@/lib/holdout.server");
        try {
          return Response.json(await runHoldout());
        } catch (e) {
          console.error("holdout", e);
          return Response.json({ error: "holdout failed" }, { status: 500 });
        }
      },
    },
  },
});
