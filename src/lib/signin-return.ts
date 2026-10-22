// What the sign-in service put in the address bar when it sent the user back.
// Read before the SDK starts, because the SDK wipes the address bar during init.
export type SigninReturn = { present: boolean; error: string | null; hasSession: boolean };

function decodeB64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

export function readSigninReturn(hash: string, search = ""): SigninReturn {
  const out: SigninReturn = { present: false, error: null, hasSession: false };
  for (const raw of [search.replace(/^\?/, ""), hash.replace(/^#/, "")]) {
    const p = new URLSearchParams(raw);
    const b64 = p.get("b64Params");
    if (!b64 && !p.get("sessionNamespace") && !p.get("error")) continue;
    out.present = true;
    if (p.get("error")) out.error = p.get("error");
    if (b64) {
      try {
        const d = JSON.parse(decodeB64Url(b64)) as Record<string, unknown>;
        if (typeof d.error === "string" && d.error) out.error = d.error;
        if (typeof d.sessionId === "string" && d.sessionId) out.hasSession = true;
      } catch { /* unreadable; treat as present without details */ }
    }
  }
  return out;
}

// Remember the page to return to across hosts/tabs for a short while.
export const SIGNIN_RETURN_KEY = "hederaPump.signinReturn";
const MAX_AGE_MS = 15 * 60_000;

export function saveSigninReturn(path: string, now = Date.now()) {
  try { localStorage.setItem(SIGNIN_RETURN_KEY, JSON.stringify({ path, at: now })); } catch { /* ignore */ }
}

export function takeSigninReturn(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(SIGNIN_RETURN_KEY) ?? sessionStorage.getItem(SIGNIN_RETURN_KEY);
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as { path?: string; at?: number };
      if (typeof v?.path === "string" && typeof v.at === "number") return now - v.at < MAX_AGE_MS ? v.path : null;
    } catch { /* legacy plain path */ }
    return raw.startsWith("/") ? raw : null;
  } catch {
    return null;
  }
}

export function clearSigninReturn() {
  try { localStorage.removeItem(SIGNIN_RETURN_KEY); sessionStorage.removeItem(SIGNIN_RETURN_KEY); } catch { /* ignore */ }
}
