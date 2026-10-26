/**
 * Notification rules shared by the server (writing notices) and the bell (showing them).
 * Every type here can be switched off per wallet in notification_prefs.
 */
export const NOTIFICATION_KINDS = ["new_follower", "comment", "graduation", "follower_buy", "follower_sell", "follower_launch", "follower_comment", "follower_graduation"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  new_follower: "New follower",
  comment: "Comment on my coin",
  graduation: "My coin graduated",
  follower_buy: "Someone I follow bought",
  follower_sell: "Someone I follow sold",
  follower_launch: "Someone I follow launched a coin",
  follower_comment: "Someone I follow commented",
  follower_graduation: "A coin by someone I follow graduated",
};

export const NOTIFICATION_HINTS: Record<NotificationKind, string> = {
  new_follower: "Someone starts following your profile.",
  comment: "Someone comments on a coin you launched.",
  graduation: "A coin you launched finishes its bonding curve.",
  follower_buy: "A wallet you follow buys a coin.",
  follower_sell: "A wallet you follow sells a coin.",
  follower_launch: "A wallet you follow launches a new coin.",
  follower_comment: "A wallet you follow comments on a coin.",
  follower_graduation: "A coin launched by a wallet you follow graduates.",
};

/** Where the bell keeps its signed-in session. */
export const NOTIF_SESSION_KEY = "hederaPump.notifSession";
export const NOTIF_SESSION_MS = 7 * 24 * 60 * 60_000;

export type NotifSession = { token: string; account: string; expiresAt: string };

/**
 * The saved sign-in for this wallet, if it is still valid. One signature opens a week of
 * notifications — and the same session also proves follows, so following needs no new approval.
 */
export function readNotifSession(account: string | null): NotifSession | null {
  try {
    const raw = localStorage.getItem(NOTIF_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as NotifSession;
    if (!s?.token || !s.account || Date.parse(s.expiresAt) <= Date.now()) return null;
    if (account && s.account !== account) return null;
    return s;
  } catch {
    return null;
  }
}

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  actor: string | null;
  token: string | null;
  symbol: string | null;
  created_at: string;
  read_at: string | null;
};

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

/** A wallet with no saved row gets every type: turning something off is the choice, not the default. */
export function prefEnabled(rows: { kind: string; enabled: boolean }[], kind: NotificationKind): boolean {
  return rows.find((r) => r.kind === kind)?.enabled ?? true;
}

/** One notice per follow, per graduation and per coin per day, so a bell never fills with repeats. */
export function followDedupe(follower: string): string {
  return `follow:${follower}`;
}
export function graduationDedupe(token: string): string {
  return `grad:${token.toLowerCase()}`;
}
export function buyDedupe(token: string, day: string): string {
  return `buy:${token.toLowerCase()}:${day}`;
}
export function sellDedupe(token: string, day: string): string {
  return `sell:${token.toLowerCase()}:${day}`;
}
export function launchDedupe(token: string): string {
  return `launch:${token.toLowerCase()}`;
}
export function commentDedupe(token: string, day: string): string {
  return `comment:${token.toLowerCase()}:${day}`;
}

/** UTC calendar day used to keep buy notices to one per coin per day. */
export function dayKey(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "unknown";
}

export function unreadCount(rows: Pick<NotificationRow, "read_at">[]): number {
  return rows.filter((r) => !r.read_at).length;
}

/**
 * Wording for the bell. `showActor` is false when the sentence already names the coin
 * itself (graduation), so no wallet name is printed in front of it.
 */
export function notificationText(n: Pick<NotificationRow, "kind" | "symbol">): { showActor: boolean; text: string } {
  const sym = n.symbol ? `$${n.symbol}` : null;
  switch (n.kind) {
    case "new_follower":
      return { showActor: true, text: "started following you" };
    case "comment":
      return { showActor: true, text: `commented on ${sym ?? "your coin"}` };
    case "follower_buy":
      return { showActor: true, text: `bought ${sym ?? "a coin"}` };
    case "follower_sell":
      return { showActor: true, text: `sold ${sym ?? "a coin"}` };
    case "follower_launch":
      return { showActor: true, text: `launched ${sym ?? "a new coin"}` };
    case "follower_comment":
      return { showActor: true, text: `commented on ${sym ?? "a coin"}` };
    case "follower_graduation":
      return { showActor: true, text: `— their coin ${sym ?? ""} graduated to SaucerSwap`.replace("  ", " ") };
    case "graduation":
      return { showActor: false, text: `${sym ?? "Your coin"} graduated to SaucerSwap` };
  }
}

/** Short "3h ago" label; older notices fall back to their date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toISOString().slice(0, 10);
}

/** Text a wallet signs once to open its own notification feed. */
export function notificationsLoginMessage(account: string, time: string, nonce: string): string {
  return ["HederaPump notifications login", `Account: ${account}`, `Time: ${time}`, `Nonce: ${nonce}`].join("\n");
}
