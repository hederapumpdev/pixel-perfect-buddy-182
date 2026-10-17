import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/payouts")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runPayouts } = await import("@/lib/payouts.server");
        try {
          return Response.json(await runPayouts());
        } catch (e) {
          console.error("payouts", e);
          return Response.json({ error: "payouts failed" }, { status: 500 });
        }
      },
    },
  },
});
