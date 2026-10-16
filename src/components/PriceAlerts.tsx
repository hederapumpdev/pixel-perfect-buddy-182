import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { priceOf, progressPct } from "@/lib/queries";

const KEY = "hederaPump.follows";
type Follow = { symbol: string; basePrice: number; lastStep: number; nearGrad: boolean };
type Map = Record<string, Follow>;

function load(): Map {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function save(m: Map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage blocked */
  }
}

function notify(title: string, body: string, href: string) {
  toast(title, { description: body, action: { label: "Open", onClick: () => (location.href = href) } });
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

export function FollowButton({ token, symbol }: { token: string; symbol: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(!!load()[token.toLowerCase()]), [token]);

  async function toggle() {
    const m = load();
    const k = token.toLowerCase();
    if (m[k]) {
      delete m[k];
      save(m);
      setOn(false);
      return;
    }
    const { data } = await supabase.from("tokens").select("*").eq("address", token).maybeSingle();
    m[k] = { symbol, basePrice: data ? priceOf(data) : 0, lastStep: 0, nearGrad: false };
    save(m);
    setOn(true);
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    } catch {
      /* ignore */
    }
    toast.success(`Following $${symbol}: you'll get an alert at +25% and near graduation`);
  }

  return (
    <Button variant={on ? "secondary" : "outline"} className="w-full" onClick={toggle}>
      {on ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
      {on ? "Stop price alerts" : "Price alerts for this coin"}
    </Button>
  );
}

/** Mounted once in the Shell: checks followed coins every minute. */
export function AlertWatcher() {
  useEffect(() => {
    async function check() {
      const m = load();
      const keys = Object.keys(m);
      if (!keys.length) return;
      const { data } = await supabase.from("tokens").select("*").in("address", keys);
      let changed = false;
      for (const t of data ?? []) {
        const f = m[t.address.toLowerCase()];
        if (!f) continue;
        const p = priceOf(t);
        if (!f.basePrice && p) {
          f.basePrice = p;
          changed = true;
        }
        const step = f.basePrice ? Math.floor((p / f.basePrice - 1) / 0.25) : 0;
        if (step > f.lastStep) {
          notify(`$${t.symbol} is up ${step * 25}%`, "Since you started following it", `/token/${t.address}`);
          f.lastStep = step;
          changed = true;
        }
        if (!f.nearGrad && (progressPct(t) >= 90 || t.graduated)) {
          notify(
            t.graduated ? `$${t.symbol} graduated!` : `$${t.symbol} is about to graduate`,
            t.graduated ? "It's now on SaucerSwap" : `${progressPct(t).toFixed(0)}% of the curve sold`,
            `/token/${t.address}`,
          );
          f.nearGrad = true;
          changed = true;
        }
      }
      if (changed) save(m);
    }
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, []);
  return null;
}
