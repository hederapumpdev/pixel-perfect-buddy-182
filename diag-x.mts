import { topicImages } from "@/lib/x-images";
import { runDailyX } from "@/lib/x-posting.server";

const origin = process.argv[2] ?? "https://hederapump.dev";
const img = topicImages[1] ?? topicImages[0] ?? "";
const url = new URL(img, origin);
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  console.log("image fetch:", res.status, res.headers.get("content-type"), url.href);
} catch (e) {
  console.log("image fetch failed:", String(e));
}
const now = new Date("2026-10-19T08:00:00Z"); // 10:00 Amsterdam tomorrow — media upload only, no tweet
console.log("runDailyX:", JSON.stringify(await runDailyX(origin, now)));
