import { createServerFn } from "@tanstack/react-start";
import { MIRROR_URL, NETWORK } from "./hedera-config";
import { STAFF_MAX, STAFF_MAX_PCT, STAFF_MIN_CLAIM_HBAR, staffClaimable, staffEarned } from "./staff";

const norm = (w: unknown) => String(w ?? "").toLowerCase().trim();
const checkPin = (p: string) => {
  const pin = process.env["ADMIN_PIN"];
  if (!pin || p.trim() !== pin.trim()) throw new Error("Wrong PIN");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StaffRow = { wallet: string; joined_at: string; left_at: string | null; share_pct: number; rate_since: string | null; earned_before: number };

/** Earned at the current % since the last % change (stops when the member leaves). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function earnedSinceRate(db: any, s: StaffRow, until?: string) {
  const end = s.left_at ?? until ?? new Date().toISOString();
  const { data: fees } = await db.rpc("fee_total_between", { p_network: NETWORK, p_from: s.rate_since ?? s.joined_at, p_to: end });
  return staffEarned(Number(fees ?? 0), Number(s.share_pct));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function balanceOf(db: any, s: StaffRow) {
  const earned = Number(s.earned_before) + (await earnedSinceRate(db, s));
  const { data: rows } = await db
    .from("bot_payouts")
    .select("hbar_amount,status")
    .eq("kind", "staff")
    .eq("recipient", s.wallet);
  // Anything not clearly failed counts as paid, so nothing is paid twice.
  const paid = (rows ?? [])
    .filter((r: { status: string }) => r.status !== "failed")
    .reduce((a: number, r: { hbar_amount: number }) => a + Number(r.hbar_amount), 0);
  return { earned, paid, claimable: staffClaimable(earned, paid), payouts: rows?.length ?? 0 };
}

/** Public team list for the site. */
export const listTeam = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("staff_members")
    .select("wallet,account_id,name,avatar,joined_at,left_at")
    .is("left_at", null)
    .order("joined_at");
  return data ?? [];
});

/** Earnings for one wallet (null if not staff). */
export const getStaffBalance = createServerFn({ method: "POST" })
  .inputValidator((d: { wallets: string[] }) => ({ wallets: (d.wallets ?? []).map(norm).slice(0, 4) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: s } = await db.from("staff_members").select("*").in("wallet", data.wallets).limit(1).maybeSingle();
    if (!s) return null;
    const b = await balanceOf(db, s);
    return { wallet: s.wallet, name: s.name, share_pct: Number(s.share_pct), joined_at: s.joined_at, left_at: s.left_at, ...b };
  });

/** Bot wallet pays the claimable amount to the staff wallet itself (anyone may trigger it safely). */
export const claimStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string }) => ({ wallet: norm(d.wallet) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: s } = await db.from("staff_members").select("*").eq("wallet", data.wallet).maybeSingle();
    if (!s) throw new Error("Not a team member");
    const b = await balanceOf(db, s);
    if (b.claimable < STAFF_MIN_CLAIM_HBAR) throw new Error(`Minimum claim is ${STAFF_MIN_CLAIM_HBAR} HBAR`);
    const tinybars = BigInt(Math.floor(b.claimable * 1e8));
    const { pay } = await import("./payouts.server");
    const { botWallet } = await import("./bot.server");
    const r = await pay(db, botWallet(), { id: `staff:${s.wallet}:${b.payouts}`, kind: "staff", recipient: s.wallet, token: "" }, tinybars);
    if (r.step === "low balance") throw new Error("Payout wallet is low on HBAR — try again later");
    if (r.step !== "sent") throw new Error("Claim could not be sent — contact support");
    return { ok: true, hbar: Number(tinybars) / 1e8 };
  });

/** Admin: team overview with balances. */
export const adminListStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => ({ pin: String(d.pin ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await db.from("staff_members").select("*").order("joined_at");
    return Promise.all((rows ?? []).map(async (s) => ({ ...s, ...(await balanceOf(db, s)) })));
  });

/** Admin: add a staff member (max 4 active). Earnings start now. */
export const adminAddStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; wallet: string; name: string; avatar?: string | null }) => {
    const name = String(d.name ?? "").trim();
    if (name.length < 2 || name.length > 32) throw new Error("Name: 2–32 characters");
    if (d.avatar && !/^[0-9a-f]{64}$/.test(d.avatar)) throw new Error("Bad image");
    return { pin: String(d.pin ?? ""), wallet: String(d.wallet ?? "").trim(), name, avatar: d.avatar ?? null };
  })
  .handler(async ({ data }) => {
    checkPin(data.pin);
    let wallet = norm(data.wallet);
    let accountId: string | null = null;
    if (/^0\.0\.\d+$/.test(data.wallet) || /^0x[0-9a-f]{40}$/.test(wallet)) {
      const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${data.wallet}`);
      if (!r.ok) throw new Error("Wallet not found on Hedera");
      const j = await r.json();
      accountId = j.account ?? null;
      wallet = norm(j.evm_address ?? wallet);
    } else throw new Error("Enter a Hedera ID (0.0.x) or 0x address");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { count } = await db.from("staff_members").select("wallet", { count: "exact", head: true }).is("left_at", null);
    const { data: existing } = await db.from("staff_members").select("wallet").eq("wallet", wallet).maybeSingle();
    if (existing) throw new Error("Already added");
    if ((count ?? 0) >= STAFF_MAX) throw new Error(`Maximum ${STAFF_MAX} team members`);
    const { error } = await db.from("staff_members").insert({ wallet, account_id: accountId, name: data.name, avatar: data.avatar, rate_since: new Date().toISOString() });
    if (error) throw new Error("Saving failed");
    return { ok: true };
  });

/** Admin: edit name/photo. */
export const adminUpdateStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; wallet: string; name: string; avatar?: string | null }) => {
    const name = String(d.name ?? "").trim();
    if (name.length < 2 || name.length > 32) throw new Error("Name: 2–32 characters");
    if (d.avatar && !/^[0-9a-f]{64}$/.test(d.avatar)) throw new Error("Bad image");
    return { pin: String(d.pin ?? ""), wallet: norm(d.wallet), name, avatar: d.avatar ?? null };
  })
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await db.from("staff_members").update({ name: data.name, avatar: data.avatar }).eq("wallet", data.wallet);
    return { ok: true };
  });

/** Admin: change a member's % from now on; earnings so far stay at the old %. */
export const adminSetStaffPct = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; wallet: string; pct: number }) => {
    if (!(typeof d.pct === "number" && d.pct >= 0 && d.pct <= STAFF_MAX_PCT)) throw new Error(`Percentage must be 0–${STAFF_MAX_PCT}%`);
    return { pin: String(d.pin ?? ""), wallet: norm(d.wallet), pct: Math.round(d.pct * 100) / 100 };
  })
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: s } = await db.from("staff_members").select("*").eq("wallet", data.wallet).maybeSingle();
    if (!s) throw new Error("Not found");
    if (s.left_at) throw new Error("This member has stopped");
    const now = new Date().toISOString();
    const frozen = Number(s.earned_before) + (await earnedSinceRate(db, s, now));
    const { error } = await db.from("staff_members")
      .update({ earned_before: frozen, rate_since: now, share_pct: data.pct })
      .eq("wallet", data.wallet).eq("rate_since", s.rate_since ?? s.joined_at);
    if (error) throw new Error("Saving failed");
    return { ok: true };
  });

/** Admin: stop earnings (already earned stays claimable). */
export const adminRemoveStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; wallet: string }) => ({ pin: String(d.pin ?? ""), wallet: norm(d.wallet) }))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await db.from("staff_members").update({ left_at: new Date().toISOString() }).eq("wallet", data.wallet).is("left_at", null);
    return { ok: true };
  });
