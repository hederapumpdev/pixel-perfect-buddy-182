import { createFileRoute } from "@tanstack/react-router";
import { db, json } from "@/lib/dexscreener";

export const Route = createFileRoute("/api/public/dexscreener/latest-block")({
  server: {
    handlers: {
      GET: async () => {
        const { data } = await (await db())
          .from("sync_state")
          .select("last_timestamp")
          .order("last_timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        // Everything up to the last synced mirror-node timestamp is indexed.
        const sec = Math.floor(Number(data?.last_timestamp ?? "0"));
        return json({ block: { blockNumber: sec, blockTimestamp: sec } });
      },
    },
  },
});
