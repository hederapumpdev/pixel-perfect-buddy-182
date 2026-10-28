// HIP-405 metadata pinned to IPFS via Pinata. SaucerSwap only reads ipfs:// (or Arweave)
// memos, so new coins store "ipfs://<cid>" pointing at this JSON. Returns null on any
// failure so callers can fall back to the hederapump.dev URL rather than block a launch.
export type IpfsMetaInput = {
  name: string; symbol: string; description?: string; imageHash?: string;
  website?: string; twitter?: string; telegram?: string; creator?: string;
};

async function pin(jwt: string, file: Blob, filename: string): Promise<string | null> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("network", "public");
  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: form,
  });
  if (!res.ok) { console.error("pinata", res.status, await res.text().catch(() => "")); return null; }
  const j = (await res.json()) as { data?: { cid?: string } };
  return j.data?.cid ?? null;
}

export function buildHip405(m: IpfsMetaInput, imageCid: string | null) {
  const img = imageCid ? `ipfs://${imageCid}` : undefined;
  return {
    name: m.name,
    creator: m.creator ?? "HederaPump",
    description: (m.description ?? "").slice(0, 1000),
    image: img, type: img ? "image/jpeg" : undefined,
    lightLogo: img, lightLogoType: img ? "image/jpeg" : undefined,
    darkLogo: img, darkLogoType: img ? "image/jpeg" : undefined,
    website: m.website || "https://hederapump.dev",
    properties: {
      website: m.website || "https://hederapump.dev",
      twitter: m.twitter?.replace(/^@/, "") || "hederapumpdev",
      telegram: m.telegram || "https://t.me/hederapump",
      category: "meme",
    },
  };
}

export async function pinTokenMetadata(m: IpfsMetaInput): Promise<string | null> {
  const jwt = process.env["PINATA_JWT"];
  if (!jwt) return null;
  try {
    let imageCid: string | null = null;
    if (m.imageHash) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin.from("token_images").select("mime,data").eq("hash", m.imageHash).maybeSingle();
      if (data?.data) {
        const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
        imageCid = await pin(jwt, new Blob([bytes], { type: data.mime || "image/jpeg" }), `${m.symbol}.jpg`);
      }
    }
    const json = JSON.stringify(buildHip405(m, imageCid));
    const cid = await pin(jwt, new Blob([json], { type: "application/json" }), `${m.symbol}.json`);
    const uri = cid ? `ipfs://${cid}` : null;
    return uri && uri.length <= 100 ? uri : null;
  } catch (e) {
    console.error("pinTokenMetadata", e);
    return null;
  }
}
