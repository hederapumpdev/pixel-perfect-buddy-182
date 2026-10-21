import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";

let staff: { wallet: string; account_id: string } | null = null;
vi.mock("@/integrations/supabase/client.server", () => {
  const q: Record<string, unknown> = {};
  for (const k of ["select", "eq", "is"]) q[k] = () => q;
  q["maybeSingle"] = async () => ({ data: staff });
  return { supabaseAdmin: { from: () => q } };
});

const priv = ed25519.utils.randomSecretKey();
const pub = bytesToHex(ed25519.getPublicKey(priv));
const ID = "0.0.10924360";
const sign = (m: string) => bytesToHex(ed25519.sign(new TextEncoder().encode(`\x19Hedera Signed Message:\n${m.length}${m}`), priv));

beforeEach(() => {
  process.env["ADMIN_PIN"] = "1234";
  staff = { wallet: "0xabc", account_id: ID };
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ key: { _type: "ED25519", key: pub } })));
});
afterEach(() => vi.unstubAllGlobals());

describe("team wallet admin login", () => {
  it("an admin team wallet with a valid signature gets admin access", async () => {
    const { walletAdminLogin, adminLoginMessage, isAdmin } = await import("@/lib/admin-auth.server");
    const time = new Date().toISOString();
    const token = await walletAdminLogin(ID, time, sign(adminLoginMessage(ID, time)));
    expect(await isAdmin(token)).toBe(true);
  });
  it("a wrong signature is rejected", async () => {
    const { walletAdminLogin } = await import("@/lib/admin-auth.server");
    const time = new Date().toISOString();
    await expect(walletAdminLogin(ID, time, sign("something else"))).rejects.toThrow();
  });
  it("a wallet without admin rights is rejected", async () => {
    const { walletAdminLogin, adminLoginMessage } = await import("@/lib/admin-auth.server");
    staff = null;
    const time = new Date().toISOString();
    await expect(walletAdminLogin(ID, time, sign(adminLoginMessage(ID, time)))).rejects.toThrow("no admin access");
  });
  it("access stops once the member is removed or loses admin", async () => {
    const { walletAdminLogin, adminLoginMessage, isAdmin } = await import("@/lib/admin-auth.server");
    const time = new Date().toISOString();
    const token = await walletAdminLogin(ID, time, sign(adminLoginMessage(ID, time)));
    staff = null;
    expect(await isAdmin(token)).toBe(false);
  });
  it("the owner PIN still works", async () => {
    const { isAdmin } = await import("@/lib/admin-auth.server");
    expect(await isAdmin("1234")).toBe(true);
    expect(await isAdmin("9999")).toBe(false);
  });
});
