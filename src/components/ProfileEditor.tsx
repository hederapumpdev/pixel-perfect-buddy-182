import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImage } from "@/lib/chain.functions";
import { getProfiles, saveProfile } from "@/lib/profile.functions";
import { imageUrl } from "@/lib/queries";
import { MIRROR_URL } from "@/lib/hedera-config";
import { profileWalletAddress } from "@/lib/profile-wallets";
import { profileEditMessage } from "@/lib/profile-message";
import { useWallet } from "@/lib/wallet";

export async function squareImage(f: File): Promise<File> {
  const bmp = await createImageBitmap(f);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (!b) throw new Error("Couldn't read this image");
  return new File([b], "avatar.jpg", { type: "image/jpeg" });
}
export const toB64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export function useProfiles(wallets: string[]) {
  const get = useServerFn(getProfiles);
  const originals = [...new Set(wallets.map((w) => w.trim().toLowerCase()))].sort();
  const ids = originals.filter((w) => /^\d+\.\d+\.\d+$/.test(w));
  const { data: aliases = {} } = useQuery({
    queryKey: ["profile-wallet-aliases", ids],
    enabled: ids.length > 0,
    staleTime: Infinity,
    queryFn: async () => Object.fromEntries(await Promise.all(ids.map(async (id) => {
      try {
        const response = await fetch(`${MIRROR_URL}/api/v1/accounts/${id}`);
        if (!response.ok) return [id, profileWalletAddress(id)];
        const account = await response.json();
        return [id, typeof account.evm_address === "string" ? account.evm_address.toLowerCase() : profileWalletAddress(id)];
      } catch {
        return [id, profileWalletAddress(id)];
      }
    }))),
  });
  const ws = [...new Set(originals.flatMap((w) => [profileWalletAddress(w), aliases[w]].filter((a): a is string => Boolean(a))))].sort();
  const profiles = useQuery({
    queryKey: ["profiles", ws],
    enabled: ws.length > 0,
    queryFn: () => get({ data: { wallets: ws } }),
    staleTime: 30_000,
  }).data ?? {};
  return Object.fromEntries(originals.flatMap((w) => {
    const profile = profiles[aliases[w] ?? profileWalletAddress(w)] ?? profiles[profileWalletAddress(w)];
    return profile ? [[w, profile]] : [];
  }));
}

export function Avatar({ hash, size = 40 }: { hash: string | null | undefined; size?: number }) {
  const url = imageUrl(hash ?? null);
  return url ? (
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="shrink-0 rounded-full bg-gradient-to-br from-primary to-accent" style={{ width: size, height: size }} />
  );
}

export function ProfileEditor({ wallet, accountId }: { wallet: string; accountId: string }) {
  const w = useWallet();
  const [x, setX] = useState("");
  const profiles = useProfiles([wallet]);
  const me = profiles[wallet.toLowerCase()];
  const save = useServerFn(saveProfile);
  const upload = useServerFn(uploadImage);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function start() {
    setName(me?.name ?? "");
    setBio(me?.bio ?? "");
    setAvatar(me?.avatar ?? null);
    setX(me?.x ?? "");
    setOpen(true);
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const img = await squareImage(f);
      const { hash } = await upload({ data: { mime: img.type, base64: await toB64(img) } });
      setAvatar(hash);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const time = new Date().toISOString();
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      const handle = x.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0] || null;
      const sig = await w.signText(profileEditMessage({ accountId, wallet, time, nonce, name: name.trim(), bio: bio.trim(), avatar, x: handle }));
      await save({ data: { accountId, wallet, time, nonce, name, bio, avatar, x: handle, ...sig } });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profile saved");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-border bg-card p-4">
        <Avatar hash={me?.avatar} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold">{me?.name ?? "No name yet"}</p>
          {me?.bio && <p className="mt-1 text-sm text-muted-foreground">{me.bio}</p>}
          {me?.x && <XLink handle={me.x} />}
        </div>
        <Button variant="outline" onClick={start}>
          Edit profile
        </Button>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        <Avatar hash={avatar} size={64} />
        <label className="cursor-pointer text-sm text-primary">
          Change picture
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Username" maxLength={24} />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder="Bio (optional)"
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Input value={x} onChange={(e) => setX(e.target.value)} placeholder="X handle (optional), e.g. @hederapumpdev" maxLength={60} />
      <p className="text-xs text-muted-foreground">Saving asks your wallet to sign — this proves the profile is yours. It costs nothing.</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Check your wallet…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function XLink({ handle }: { handle: string }) {
  return (
    <p className="mt-1 text-sm">
      <a href={`https://x.com/${handle}`} target="_blank" rel="noreferrer nofollow" className="text-primary hover:underline">@{handle}</a>
      <span className="ml-2 text-xs text-muted-foreground">(not verified)</span>
    </p>
  );
}
