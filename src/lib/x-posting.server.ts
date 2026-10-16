import { appTweet, dailyXSlot, localXTime } from "./x-content";
import { sendXTweet, xAuthorization } from "./x-oauth.server";
import { topicImages } from "./x-images";

export async function runDailyX(origin: string, now = new Date()) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: locked, error: lockError } = await db.rpc("acquire_x_posting_lease");
  if (lockError) throw new Error("Could not lock X posting");
  if (!locked) return { step: "paused or busy" };
  try {
    // Uncertain requests are never sent again: X does not offer a posting idempotency key.
    const { data: uncertain, error: uncertainError } = await db.from("x_daily_posts").select("slot").in("status", ["sending", "unknown"]).limit(1);
    if (uncertainError) throw new Error("Could not read X progress");
    if (uncertain?.length) {
      await db.from("x_posting_state").update({ pause_reason: "An earlier post has no confirmation. Check the X timeline before resuming." }).eq("id", 1);
      return { step: "unknown post; paused" };
    }
    const { data: first, error: firstError } = await db.from("x_daily_posts").select("status").eq("slot", "introduction").maybeSingle();
    if (firstError) throw new Error("Could not read introduction status");
    const slot = dailyXSlot(now, !first);
    if (!slot) return { step: "outside posting hours" };
    const { data: existing, error: existingError } = await db.from("x_daily_posts").select("slot").eq("slot", slot).maybeSingle();
    if (existingError) throw new Error("Could not read X slot");
    if (existing) return { step: "already processed" };
    const { count, error: countError } = await db.from("x_daily_posts").select("slot", { count: "exact", head: true }).eq("status", "sent");
    if (countError) throw new Error("Could not read X sequence");
    const text = appTweet(count ?? 0, localXTime(now).day);
    const { data: savedMedia, error: mediaError } = await db.from("x_daily_media").select("media_id,expires_at").eq("slot", slot).maybeSingle();
    if (mediaError) throw new Error("Could not read image progress");
    let mediaId = savedMedia && new Date(savedMedia.expires_at) > now ? savedMedia.media_id : null;
    // One external transaction per scheduled invocation to keep callbacks short.
    if (!mediaId) {
    const selectedImage = topicImages[(count ?? 0) % topicImages.length] ?? topicImages[0];
    const image = await fetch(new URL(selectedImage, origin), { signal: AbortSignal.timeout(4_000) });
    if (!image.ok) throw new Error("Tweet image is unavailable");
    const mediaUrl = "https://api.x.com/2/media/upload";
    const form = new FormData();
    form.set("media_category", "tweet_image");
    form.set("media", await image.blob(), "hederapump.jpg");
    const upload = await fetch(mediaUrl, { method: "POST", headers: { Authorization: xAuthorization("POST", mediaUrl) }, body: form, signal: AbortSignal.timeout(4_000) });
    if (!upload.ok) {
      const reason = `X image upload failed (HTTP ${upload.status}). Check media upload permission and X API billing.`;
      await db.from("x_posting_state").update({ pause_reason: reason }).eq("id", 1);
      return { step: "paused", error: reason };
    }
    const media = await upload.json() as { data?: { id?: string; expires_after_secs?: number } };
    if (!media.data?.id) throw new Error("X did not confirm the image upload");
    const { error: savedError } = await db.from("x_daily_media").upsert({ slot, media_id: media.data.id, expires_at: new Date(now.getTime() + (media.data.expires_after_secs ?? 3600) * 1000).toISOString() });
    if (savedError) throw new Error("Could not save image progress");
    return { step: "image uploaded" };
    }
    const { error: claimError } = await db.from("x_daily_posts").insert({ slot, text });
    if (claimError) throw new Error("Could not reserve X post");
    try {
      const sent = await sendXTweet(text, mediaId);
      if (!sent.ok) {
        await db.from("x_daily_posts").update({ status: "failed", error: sent.error }).eq("slot", slot);
        await db.from("x_posting_state").update({ pause_reason: sent.error }).eq("id", 1);
        return { step: "paused", error: sent.error };
      }
      const { error } = await db.from("x_daily_posts").update({ status: "sent", tweet_id: sent.id }).eq("slot", slot);
      if (error) throw new Error("Could not save X confirmation");
      return { step: "sent", tweetId: sent.id };
    } catch {
      await db.from("x_daily_posts").update({ status: "unknown", error: "No reliable X confirmation; check the timeline." }).eq("slot", slot);
      await db.from("x_posting_state").update({ pause_reason: "No reliable X confirmation; check the timeline before resuming." }).eq("id", 1);
      return { step: "unknown; paused" };
    }
  } finally {
    await db.from("x_posting_state").update({ lease_until: null }).eq("id", 1);
  }
}