import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, useProfiles } from "@/components/ProfileEditor";
import { useWallet } from "@/lib/wallet";
import {
  getNotificationPrefs,
  getNotifications,
  loginNotifications,
  markNotificationsRead,
  setNotificationPref,
} from "@/lib/notifications.functions";
import {
  NOTIF_SESSION_KEY,
  NOTIFICATION_HINTS,
  NOTIFICATION_KINDS,
  NOTIFICATION_LABELS,
  isNotificationKind,
  notificationText,
  notificationsLoginMessage,
  prefEnabled,
  timeAgo,
  unreadCount,
  type NotificationKind,
  type NotificationRow,
} from "@/lib/notifications";

type Session = { token: string; account: string; expiresAt: string };

/** The bell only works for the wallet that signed in, and only until the session runs out. */
function readSession(account: string | null): Session | null {
  try {
    const raw = localStorage.getItem(NOTIF_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.token || !s.account || Date.parse(s.expiresAt) <= Date.now()) return null;
    if (account && s.account !== account) return null;
    return s;
  } catch {
    return null;
  }
}

/** Header bell: unread count, the feed itself, and a switch per notice type. */
export function NotificationBell() {
  const w = useWallet();
  const me = w.accountId;
  const qc = useQueryClient();
  const login = useServerFn(loginNotifications);
  const fetchFeed = useServerFn(getNotifications);
  const readFeed = useServerFn(markNotificationsRead);
  const fetchPrefs = useServerFn(getNotificationPrefs);
  const savePref = useServerFn(setNotificationPref);

  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSession(readSession(me));
  }, [me]);

  const token = session?.token;
  const feed = useQuery({
    queryKey: ["notifications", token],
    enabled: !!token,
    queryFn: () => fetchFeed({ data: { token: token! } }),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const prefs = useQuery({
    queryKey: ["notification-prefs", token],
    enabled: !!token && settings,
    queryFn: () => fetchPrefs({ data: { token: token! } }),
    staleTime: 30_000,
  });

  const rows: NotificationRow[] = (feed.data?.rows ?? []).flatMap((r) =>
    isNotificationKind(r.kind) ? [{ ...r, kind: r.kind }] : [],
  );
  const actors = rows.map((r) => r.actor).filter((a): a is string => !!a);
  const profiles = useProfiles(actors);
  const unread = feed.data?.unread ?? unreadCount(rows);

  async function turnOn() {
    if (!me) return;
    setBusy(true);
    try {
      const time = new Date().toISOString();
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      const sig = await w.signText(notificationsLoginMessage(me, time, nonce));
      const res = await login({ data: { account: me, time, nonce, ...sig } });
      const s = { token: res.token, account: me, expiresAt: res.expiresAt };
      localStorage.setItem(NOTIF_SESSION_KEY, JSON.stringify(s));
      setSession(s);
      setOpen(true);
      toast.success("Notifications are on");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    if (!token) return;
    try {
      await readFeed({ data: { token } });
      await qc.invalidateQueries({ queryKey: ["notifications", token] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function togglePref(kind: NotificationKind, enabled: boolean) {
    if (!token) return;
    try {
      await savePref({ data: { token, kind, enabled } });
      await qc.invalidateQueries({ queryKey: ["notification-prefs", token] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!me) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        className="relative rounded-md border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[92vw] rounded-lg border border-border bg-card p-2 shadow-xl">
          <div className="flex items-center gap-2 px-1 pb-2">
            <span className="font-display text-sm font-bold">Notifications</span>
            {!!token && (
              <>
                <button
                  type="button"
                  onClick={() => setSettings((s) => !s)}
                  aria-label="Notification settings"
                  className={`ml-auto rounded p-1 hover:bg-muted ${settings ? "text-primary" : "text-muted-foreground"}`}
                >
                  <Settings2 className="h-4 w-4" />
                </button>
                {unread > 0 && (
                  <button type="button" onClick={markAll} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Mark all as read">
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>

          {!token ? (
            <div className="p-2">
              <p className="text-sm text-muted-foreground">
                Turn this on to be told when someone follows you, comments on your coin, your coin graduates, or someone you follow buys.
              </p>
              <Button size="sm" className="mt-3 w-full" disabled={busy} onClick={turnOn}>
                Turn on notifications
              </Button>
            </div>
          ) : settings ? (
            <div className="space-y-1">
              {NOTIFICATION_KINDS.map((kind) => (
                <label key={kind} className="flex items-start gap-3 rounded p-2 hover:bg-muted">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{NOTIFICATION_LABELS[kind]}</span>
                    <span className="block text-xs text-muted-foreground">{NOTIFICATION_HINTS[kind]}</span>
                  </span>
                  <Switch
                    className="ml-auto mt-1"
                    checked={prefEnabled(prefs.data ?? [], kind)}
                    onCheckedChange={(v) => togglePref(kind, !!v)}
                  />
                </label>
              ))}
            </div>
          ) : feed.isFetching && !rows.length ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nothing yet. New notices show up here.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {rows.map((r) => {
                const { showActor, text } = notificationText(r);
                const who = showActor && r.actor ? profiles[r.actor]?.name ?? r.actor : null;
                const inner = (
                  <>
                    <Avatar hash={r.actor ? profiles[r.actor]?.avatar : null} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {who && <span className="font-semibold">{who} </span>}
                        {text}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </span>
                    {!r.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </>
                );
                const cls = "flex w-full items-center gap-2 rounded p-2 text-left hover:bg-muted";
                return r.token ? (
                  <Link key={r.id} to="/token/$id" params={{ id: r.token }} className={cls} onClick={() => void readFeed({ data: { token: token!, ids: [r.id] } })}>
                    {inner}
                  </Link>
                ) : r.actor ? (
                  <Link key={r.id} to="/profile/$wallet" params={{ wallet: r.actor }} className={cls} onClick={() => void readFeed({ data: { token: token!, ids: [r.id] } })}>
                    {inner}
                  </Link>
                ) : (
                  <div key={r.id} className={cls}>
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
