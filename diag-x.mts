import { topicImageUrls } from "@/lib/x-images.server";
import { runDailyX } from "@/lib/x-posting.server";

const origin = process.argv[2] ?? "https://hederapump.dev";
const img = topicImageUrls[1] ?? topicImageUrls[0] ?? "";
console.log("image url:", new URL(img, origin).toString());
const res = await fetch(new URL(img, origin), { signal: AbortSignal.timeout(4_000) });
console.log("image fetch:", res.status, res.headers.get("content-type"), new URL(img, origin).toString());

const result = await runDailyX(origin, new Date("2026-10-19T08:00:00Z"));
console.log("runDailyX:", JSON.stringify(result));
