// Server-only: generates an original square logo for an official coin via the Lovable AI Gateway.
// Returns null on any failure so the caller can fall back to the bundled mascot — a coin never launches without an image.
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const MAX_BYTES = 600_000;

export function coinLogoPrompt(name: string, symbol: string) {
  return (
    `Square meme coin logo for an original cryptocurrency named "${name}" ($${symbol}). ` +
    "One cute, bold cartoon mascot that fits the name, flat vibrant colors, thick clean outlines, " +
    "centered on a circular gradient badge with a dark background. " +
    "No text, no letters, no numbers, no existing brand or token logos."
  );
}

export async function generateCoinLogo(name: string, symbol: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: coinLogoPrompt(name, symbol),
        size: "1024x1024",
        quality: "low",
        output_format: "jpeg",
        output_compression: 80,
      }),
    });
    if (!r.ok) {
      console.error("Coin logo generation failed", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const j = (await r.json()) as { data?: { b64_json?: string }[] };
    const b64 = j.data?.[0]?.b64_json;
    if (!b64 || (b64.length * 3) / 4 > MAX_BYTES) return null;
    return b64;
  } catch (e) {
    console.error("Coin logo generation error", e);
    return null;
  }
}
