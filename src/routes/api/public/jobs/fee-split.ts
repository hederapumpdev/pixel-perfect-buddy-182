import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/fee-split")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runFeeSplit } = await import("@/lib/fund-wallets.server");
        try {
          return Response.json(JSON.parse(JSON.stringify(await runFeeSplit(), (_k, v) => (typeof v === "bigint" ? v.toString() : v))));
        } catch (e) {
          console.error("fee-split", e);
          return Response.json({ error: "fee split failed" }, { status: 500 });
        }
      },
    },
  },
});
