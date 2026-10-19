import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/jobs/official-coin")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = z.object({ replacement: z.boolean().optional() }).strict().safeParse(await request.json().catch(() => ({})));
        if (!body.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const { createOfficialCoin } = await import("@/lib/official-coins.server");
        try {
          return Response.json(await createOfficialCoin(new Date(), body.data.replacement === true));
        } catch (e) {
          console.error("official-coin", e);
          return Response.json({ error: "official coin failed" }, { status: 500 });
        }
      },
    },
  },
});
