import { createHmac, randomBytes } from "node:crypto";

const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function xAuthorization(method: string, url: string, query: Record<string, string> = {}) {
  const key = process.env["X_CONSUMER_KEY"];
  const secret = process.env["X_CONSUMER_SECRET"];
  const token = process.env["X_ACCESS_TOKEN"];
  const tokenSecret = process.env["X_ACCESS_TOKEN_SECRET"];
  if (!key || !secret || !token || !tokenSecret) throw new Error("X credentials are not configured");
  const oauth: Record<string, string> = {
    oauth_consumer_key: key, oauth_token: token,
    oauth_nonce: randomBytes(24).toString("hex"),
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_signature_method: "HMAC-SHA1", oauth_version: "1.0",
  };
  const parameters = Object.entries({ ...query, ...oauth }).map(([k, v]): [string, string] => [encode(k), encode(v)]).sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
  oauth["oauth_signature"] = createHmac("sha1", `${encode(secret)}&${encode(tokenSecret)}`).update(`${method.toUpperCase()}&${encode(url)}&${encode(parameters)}`).digest("base64");
  return "OAuth " + Object.entries(oauth).map(([k, v]) => `${encode(k)}="${encode(v)}"`).join(", ");
}

export async function sendXTweet(text: string, mediaId: string) {
  const url = "https://api.x.com/2/tweets";
  const response = await fetch(url, { method: "POST", headers: { Authorization: xAuthorization("POST", url), "Content-Type": "application/json" }, body: JSON.stringify({ text, media: { media_ids: [mediaId] } }), signal: AbortSignal.timeout(4_000) });
  if (!response.ok) {
    // Never store raw provider bodies: they may echo credential-bearing headers.
    return { ok: false as const, status: response.status, error: `X rejected the post (HTTP ${response.status}). Check X posting permissions and API billing.` };
  }
  const body = await response.json() as { data?: { id?: string } };
  if (!body.data?.id) throw new Error("X returned no post confirmation");
  return { ok: true as const, id: body.data.id };
}