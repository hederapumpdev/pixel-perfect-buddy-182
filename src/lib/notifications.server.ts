import { MIRROR_URL } from "./hedera-config";
import { buyDedupe, dayKey, graduationDedupe, isNotificationKind, type NotificationKind } from "./notifications";

type Supabase = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const isAccount = (v: unknown): v is string => typeof v === "string" && /^0\.0\.\d{1,20}$/.test(v);

const evmCache = new Map<string, string | null>();

/** Maps an on-chain 0x address to the 0.0.x account behind it (cached per worker). */
export async function evmToAccount(evm: string): Promise<string | null> {
  const key = String(evm).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(key)) return null;
  if (evmCache.has(key)) return evmCache.get(key) ?? null;
  let out: string | null = null;
  try {
    const res = await fetch(`${MIRROR_URL}/api/v1/accounts/${key}`);
    if (res.ok) {
      const acct = (await res.json()) as { account?: unknown };
      if (isAccount(acct.account)) out = acct.account;
    }
  } catch {
    out = null;
  }
  if (evmCache.size > 4000) evmCache.clear();
  evmCache.set(key, out);
  return out;
}

type Notice = { kind: NotificationKind; actor?: string | null; token?: string | null; symbol?: string | null; dedupe?: string | null };

/** Writes one notice per wallet that still has this type switched on. */
export async function notifyMany(db: Supabase, accounts: string[], n: Notice) {
  let targets = [...new Set(accounts)].filter(isAccount);
  if (!targets.length || !isNotificationKind(n.kind)) return;
  const { data: off } = await db
    .from("notification_prefs")
    .select("account")
    .in("account", targets)
    .eq("kind", n.kind)
    .eq("enabled", false);
  const skip = new Set((off ?? []).map((r) => r.account));
  targets = targets.filter((a) => !skip.has(a));
  if (n.dedupe) {
    const { data: seen } = await db
      .from("notifications")
      .select("account")
      .in("account", targets)
      .eq("kind", n.kind)
      .eq("dedupe_key", n.dedupe);
    const done = new Set((seen ?? []).map((r) => r.account));
    targets = targets.filter((a) => !done.has(a));
  }
  if (!targets.length) return;
  const rows = targets.map((a) => ({
    account: a,
    kind: n.kind,
    actor: n.actor && isAccount(n.actor) ? n.actor : null,
    token: n.token ? String(n.token).toLowerCase().slice(0, 80) : null,
    symbol: n.symbol ? String(n.symbol).slice(0, 16) : null,
    dedupe_key: n.dedupe ? String(n.dedupe).slice(0, 120) : null,
  }));
  const { error } = await db.from("notifications").insert(rows);
  if (error) console.error("notification insert failed", error.message);
}

export function notifyUser(db: Supabase, account: string, n: Notice) {
  return notifyMany(db, [account], n);
}

/** "Someone I follow bought" — one notice per follower per coin per day. */
export async function notifyFollowersOfBuy(db: Supabase, traderEvm: string, token: string, symbol: string, whenIso: string) {
  const trader = await evmToAccount(traderEvm);
  if (!trader) return;
  const { data: rows } = await db.from("wallet_follows").select("follower").eq("followee", trader).limit(500);
  await notifyMany(db, (rows ?? []).map((r) => r.follower), {
    kind: "follower_buy",
    actor: trader,
    token,
    symbol,
    dedupe: buyDedupe(token, dayKey(whenIso)),
  });
}

/** A comment on a coin goes to the person who launched it, never to their own comments. */
export async function notifyCoinCreatorOfComment(db: Supabase, token: string, authorEvm: string) {
  const { data: coin } = await db.from("tokens").select("creator,symbol").eq("address", token).maybeSingle();
  if (!coin) return;
  const account = await evmToAccount(coin.creator);
  if (!account) return;
  const author = await evmToAccount(authorEvm);
  if (author === account) return;
  await notifyUser(db, account, { kind: "comment", actor: author, token, symbol: coin.symbol });
}

/** A finished bonding curve is news for the person who launched the coin. */
export async function notifyCoinGraduated(db: Supabase, token: string) {
  const { data: coin } = await db.from("tokens").select("creator,symbol").eq("address", token).maybeSingle();
  if (!coin) return;
  const account = await evmToAccount(coin.creator);
  if (!account) return;
  await notifyUser(db, account, { kind: "graduation", token, symbol: coin.symbol, dedupe: graduationDedupe(token) });
}
