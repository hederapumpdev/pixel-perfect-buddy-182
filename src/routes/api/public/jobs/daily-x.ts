import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/daily-x")({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { runDailyX } = await import("@/lib/x-posting.server");
    try { return Response.json(await runDailyX(new URL(request.url).origin)); }
    catch { return Response.json({ error: "Daily X posting could not finish" }, { status: 500 }); }
  } } },
});