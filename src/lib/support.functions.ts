import { createServerFn } from "@tanstack/react-start";

const requirePin = async (p: unknown) => (await import("./admin-auth.server")).requireAdmin(p);

/** Anyone can send a support request; it lands in the admin page. */
export const submitSupport = createServerFn({ method: "POST" })
  .inputValidator((d: { contact: string; wallet?: string; message: string }) => {
    const contact = String(d.contact ?? "").trim();
    const message = String(d.message ?? "").trim();
    const wallet = String(d.wallet ?? "").trim();
    if (contact.length < 3 || contact.length > 200) throw new Error("Enter your email or Telegram/X handle");
    if (message.length < 5 || message.length > 4000) throw new Error("Describe your question (5–4000 characters)");
    if (wallet.length > 100) throw new Error("Wallet is too long");
    return { contact, message, wallet: wallet || null };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_requests").insert(data);
    if (error) throw new Error("Sending failed, please try again");
    return { ok: true };
  });

export const listSupport = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => d)
  .handler(async ({ data }) => {
    await requirePin(data.pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("support_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Loading failed");
    return rows;
  });

export const setSupportStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string; id: string; status: "open" | "done" }) => {
    if (d.status !== "open" && d.status !== "done") throw new Error("Invalid status");
    return d;
  })
  .handler(async ({ data }) => {
    await requirePin(data.pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_requests").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Saving failed");
    return { ok: true };
  });
