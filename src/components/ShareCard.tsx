import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtHbar, imageUrl, mcapOf, progressPct, type TokenRow } from "@/lib/queries";
import logo from "@/assets/hederapump-logo.png";

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function drawCard(t: TokenRow): Promise<Blob> {
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#07130f");
  bg.addColorStop(1, "#071226");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const img = imageUrl(t.image_url);
  if (img) {
    try {
      const i = await loadImg(img);
      g.save();
      g.beginPath();
      g.roundRect(70, 140, 340, 340, 32);
      g.clip();
      g.drawImage(i, 70, 140, 340, 340);
      g.restore();
    } catch {
      /* no image */
    }
  }
  try {
    const l = await loadImg(logo);
    g.drawImage(l, 70, 50, 56, 56);
  } catch {
    /* ignore */
  }
  g.fillStyle = "#ffffff";
  g.font = "bold 34px 'Space Grotesk', sans-serif";
  g.fillText("HederaPump", 140, 90);
  g.font = "bold 72px 'Space Grotesk', sans-serif";
  g.fillText(t.name.slice(0, 18), 460, 230);
  g.fillStyle = "#34d399";
  g.font = "bold 48px 'Space Grotesk', sans-serif";
  g.fillText(`$${t.symbol}`, 460, 300);
  g.fillStyle = "#cbd5e1";
  g.font = "32px 'DM Sans', sans-serif";
  g.fillText(`Market cap ${fmtHbar(mcapOf(t))}`, 460, 370);
  const pct = progressPct(t);
  g.fillStyle = "#1e293b";
  g.fillRect(460, 410, 640, 24);
  const bar = g.createLinearGradient(460, 0, 1100, 0);
  bar.addColorStop(0, "#34d399");
  bar.addColorStop(1, "#3b82f6");
  g.fillStyle = bar;
  g.fillRect(460, 410, (640 * pct) / 100, 24);
  g.fillStyle = "#cbd5e1";
  g.font = "26px 'DM Sans', sans-serif";
  g.fillText(t.graduated ? "Graduated · on SaucerSwap" : `${pct.toFixed(1)}% to graduation`, 460, 475);
  g.fillStyle = "#94a3b8";
  g.font = "24px monospace";
  g.fillText(`${location.host}/token/${t.address.slice(0, 10)}…`, 70, 570);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No image"))), "image/png"));
}

export function ShareButton({ t }: { t: TokenRow }) {
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const url = `${location.origin}/token/${t.address}`;
      const text = `$${t.symbol} is live on HederaPump 🚀`;
      const blob = await drawCard(t);
      const file = new File([blob], `${t.symbol}-hederapump.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${url}` });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        await navigator.clipboard?.writeText(`${text}\n${url}`).catch(() => {});
        toast.success("Image downloaded, link copied");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Couldn't make the share image");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={share} disabled={busy}>
      <Share2 className="h-4 w-4" /> {busy ? "…" : "Share"}
    </Button>
  );
}
