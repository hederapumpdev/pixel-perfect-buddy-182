// Server-only: automatic promotion posts to X, Telegram and Discord.
// Every post is claimed in promo_posts before sending; one external send per call;
// uncertain sends are marked "unknown" and never retried automatically.
import { NETWORK } from "./hedera-config";
import { CONTEST_PRIZE_HBAR, contestLeaderboard, weekKey, weekStart } from "./promotions";
import {
  contestMessages,
  contestSlot,
  discordDailySlot,
  graduationDiscordMessage,
  graduationSlot,
  graduationXMessage,
  weeklyMessages,
  weeklySlot,
  type PromoCoin,
} from "./promo-content";
import { xAuthorization } from "./x-oauth.server";
import { TelegramError, telegram } from "./telegram.server";
import { telegramImage } from "./telegram-images.server";

const DISCORD_ANNOUNCEMENTS_CHANNEL = "1561015919428378665";
const TELEGRAM_CHAT = "@hederapump";
const CHANNELS = ["x", "telegram", "discord"] as const;
type Channel = (typeof CHANNELS)[number];

class PromoSendError extends Error {
  constructor(message: string, public definite: boolean) {
    super(message);
  }
}

async function sendXText(text: string): Promise<string> {
  const url = "https://api.x.com/2/tweets";
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: xAuthorization("POST", url), "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new PromoSendError(`X rejected the post (HTTP ${response.status})`, true);
  const body = (await response.json()) as { data?: { id?: string } };
  if (!body.data?.id) throw new PromoSendError("X returned no post confirmation", false);
  return body.data.id;
}

async function sendTelegram(text: string, image: Blob): Promise<string> {
  const sent = await telegram("sendPhoto", { chat_id: TELEGRAM_CHAT, caption: text, parse_mode: "HTML", photo: "attach://image" }, image);
  if (!sent?.message_id) throw new PromoSendError("No Telegram confirmation", false);
  return String(sent.message_id);
}

async function sendDiscord(text: string, nonce: string): Promise<string> {
  const key = process.env["DISCORD_API_KEY"];
  const appKey = process.env["LOVABLE_API_KEY"];
  if (!key || !appKey) throw new PromoSendError("Discord connection is not configured", true);
  const response = await fetch(`https://connector-gateway.lovable.dev/discord/channels/${DISCORD_ANNOUNCEMENTS_CHANNEL}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appKey}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ content: text, allowed_mentions: { parse: [] }, nonce, enforce_nonce: true }),
    signal: AbortSignal.timeout(4_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new PromoSendError(`Discord [${response.status}]`, response.status < 500);
  const sent = JSON.parse(raw) as { id?: string };
  if (!sent.id) throw new PromoSendError("No Discord confirmation", false);
  return sent.id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Posts the first unsettled channel for a slot; one external send per call. */
async function sendNext(db: Db, slot: string, texts: Partial<Record<Channel, string>>, imageKind: "app" | "graduation", imageIndex = 0) {
  for (const channel of CHANNELS) {
    const text = texts[channel];
    if (!text) continue;
    const { data: existing, error } = await db.from("promo_posts").select("status").eq("slot", slot).eq("channel", channel).maybeSingle();
    if (error) throw error;
    if (existing) {
      if (existing.status === "sending" || existing.status === "unknown") return { step: `${channel} awaiting review` };
      continue; // sent / failed / skipped are settled
    }
    const { error: claimError } = await db.from("promo_posts").insert({ slot, channel, status: "sending", text });
    if (claimError) {
      if (claimError.code === "23505") return { step: "claimed elsewhere" };
      throw claimError;
    }
    try {
      const id =
        channel === "x"
          ? await sendXText(text)
          : channel === "telegram"
            ? await sendTelegram(text, telegramImage(imageKind, imageIndex))
            : await sendDiscord(text, slot);
      const { error: saved } = await db.from("promo_posts").update({ status: "sent", external_id: id, last_error: null }).eq("slot", slot).eq("channel", channel);
      if (saved) throw saved;
      return { step: `${channel} sent` };
    } catch (e) {
      const definite = e instanceof PromoSendError ? e.definite : e instanceof TelegramError ? e.status < 500 : false;
      await db.from("promo_posts").update({ status: definite ? "failed" : "unknown", last_error: e instanceof Error ? e.message.slice(0, 300) : "send failed" }).eq("slot", slot).eq("channel", channel);
      return { step: `${channel} ${definite ? "failed" : "unknown"}` };
    }
  }
  return { step: "all settled" };
}

/** Monday: announce last week's contest winner once the prize payout is confirmed. */
export async function announceContest(now = new Date()) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const thisWeek = weekStart(now);
  const lastWeek = new Date(thisWeek.getTime() - 7 * 86_400_000);
  const key = weekKey(lastWeek);
  const slot = contestSlot(key);
  const { data: prize, error } = await db.from("bot_payouts").select("*").eq("id", `prize:${key}`).maybeSingle();
  if (error) throw error;
  if (!prize) return { step: "prize not processed yet" };
  if (prize.status === "no_winner") {
    for (const channel of CHANNELS) await db.from("promo_posts").upsert({ slot, channel, status: "skipped" });
    return { step: "no winner" };
  }
  if (prize.status !== "done") return { step: "prize not confirmed" };
  const { data: coin, error: coinError } = await db.from("tokens").select("address,name,symbol,creator").eq("address", prize.token).eq("network", NETWORK).single();
  if (coinError) throw coinError;
  const trades: { token: string; hbar_amount: number; created_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("trades").select("token,hbar_amount,created_at").eq("network", NETWORK).gte("created_at", lastWeek.toISOString()).lt("created_at", thisWeek.toISOString()).range(from, from + 999);
    trades.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const board = contestLeaderboard(trades, () => coin.creator, lastWeek, thisWeek);
  const volume = board.find((e) => e.token === prize.token)?.volume ?? 0;
  return sendNext(db, slot, contestMessages(coin as PromoCoin, volume, CONTEST_PRIZE_HBAR), "app", 1);
}

/** Mirrors each sent daily X post to Discord #announcements, one per call. */
export async function mirrorDailyToDiscord() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: posts, error } = await db.from("x_daily_posts").select("slot,text,created_at").eq("status", "sent").order("created_at").limit(50);
  if (error) throw error;
  for (const post of posts ?? []) {
    const slot = discordDailySlot(post.slot);
    const { data: existing, error: readError } = await db.from("promo_posts").select("status").eq("slot", slot).eq("channel", "discord").maybeSingle();
    if (readError) throw readError;
    if (existing) {
      if (existing.status === "sending" || existing.status === "unknown") return { step: "awaiting review" };
      continue;
    }
    return sendNext(db, slot, { discord: post.text }, "app");
  }
  return { step: "up to date" };
}

/** Posts every confirmed graduation to X and Discord (Telegram has its own queue). */
export async function promoteGraduation() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: grads, error } = await db.from("telegram_graduation_posts").select("token,created_at").order("created_at").limit(50);
  if (error) throw error;
  for (const grad of grads ?? []) {
    const slot = graduationSlot(grad.token);
    for (const channel of ["x", "discord"] as const) {
      const { data: existing, error: readError } = await db.from("promo_posts").select("status").eq("slot", slot).eq("channel", channel).maybeSingle();
      if (readError) throw readError;
      if (existing) {
        if (existing.status === "sending" || existing.status === "unknown") return { step: `${channel} awaiting review` };
        continue;
      }
      const { data: coin, error: coinError } = await db.from("tokens").select("address,name,symbol,graduated").eq("address", grad.token).eq("network", NETWORK).single();
      if (coinError) throw coinError;
      if (!coin.graduated) return { step: "graduation not confirmed" };
      const text = channel === "x" ? graduationXMessage(coin as PromoCoin) : graduationDiscordMessage(coin as PromoCoin);
      return sendNext(db, slot, { [channel]: text }, "graduation");
    }
  }
  return { step: "up to date" };
}

/** Sunday: posts the past 7 days of launchpad activity to all three channels. */
export async function postWeeklySummary(now = new Date()) {
  if (now.getUTCDay() !== 0) return { step: "not sunday" };
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - 7 * 86_400_000);
  const slot = weeklySlot(to.toISOString().slice(0, 10));
  const trades: { hbar_amount: number; trader: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("trades").select("hbar_amount,trader").eq("network", NETWORK).gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).range(offset, offset + 999);
    if (error) throw error;
    trades.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const { count: coins, error: coinsError } = await db.from("tokens").select("address", { count: "exact", head: true }).eq("network", NETWORK).gte("created_at", from.toISOString()).lt("created_at", to.toISOString());
  if (coinsError) throw coinsError;
  const stats = {
    coins: coins ?? 0,
    trades: trades.length,
    volumeHbar: trades.reduce((sum, t) => sum + Number(t.hbar_amount), 0),
    traders: new Set(trades.map((t) => t.trader.toLowerCase())).size,
  };
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return sendNext(db, slot, weeklyMessages(stats, day(from), day(to)), "app", 2);
}
