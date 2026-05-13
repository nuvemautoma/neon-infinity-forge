// Vercel serverless function — POST /api/webhook/cakto
// Webhook da Cakto: cria/atualiza usuários conforme o plano comprado.
// Mesma lógica de src/routes/api/public/webhook/cakto.ts, em formato Vercel.

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

const webhookSchema = z.object({
  event: z.string().min(1).max(100),
  secret: z.string().optional(),
  data: z.object({
    email: z.string().email().max(255),
    name: z.string().min(1).max(255).optional(),
    plan: z.string().min(1).max(50).optional(),
    product_id: z.string().max(100).optional(),
    offer_id: z.string().max(100).optional(),
    product_name: z.string().max(255).optional(),
  }),
});

const VALID_PLANS = new Set(["plus", "enterprise"]);
const REFUND_EVENTS = new Set([
  "refunded", "refund", "chargeback", "charged_back",
  "dispute", "disputed", "reembolso", "estorno",
]);
const PURCHASE_EVENTS = new Set([
  "purchase", "approved", "paid", "purchase_approved", "compra_aprovada",
]);

function inList(env: string | undefined): string[] {
  return (env || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function resolvePlan(data: {
  plan?: string; product_id?: string; offer_id?: string; product_name?: string;
}): string {
  const explicit = (data.plan || "").toLowerCase().trim();
  if (VALID_PLANS.has(explicit)) return explicit;

  const ids = [data.product_id, data.offer_id].filter(Boolean).map((s) => String(s).trim());
  const plusIds = [...inList(process.env.CAKTO_PRODUCT_PLUS), ...inList(process.env.CAKTO_OFFER_PLUS)];
  const entIds = [...inList(process.env.CAKTO_PRODUCT_ENTERPRISE), ...inList(process.env.CAKTO_OFFER_ENTERPRISE)];

  if (ids.some((i) => entIds.includes(i))) return "enterprise";
  if (ids.some((i) => plusIds.includes(i))) return "plus";

  const name = (data.product_name || "").toLowerCase();
  if (name.includes("enterprise")) return "enterprise";
  if (name.includes("plus")) return "plus";
  return "plus";
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const sig = signature.replace(/^sha256=/, "").trim();
    if (sig.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function findUserByEmail(admin: ReturnType<typeof getAdmin>, email: string) {
  const { data } = await admin.auth.admin.listUsers();
  return data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const secret = process.env.CAKTO_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[cakto] CAKTO_WEBHOOK_SECRET not configured");
      return json({ error: "Webhook not configured" }, 503);
    }

    const url = new URL(req.url);
    const headerSig = req.headers.get("x-webhook-signature") || req.headers.get("x-cakto-signature");
    const querySecret = url.searchParams.get("secret");

    let parsedBody: any = {};
    try { parsedBody = JSON.parse(rawBody); } catch {}
    const bodySecret = parsedBody?.secret;

    const ok =
      verifySignature(rawBody, headerSig, secret) ||
      (typeof querySecret === "string" && safeEq(querySecret, secret)) ||
      (typeof bodySecret === "string" && safeEq(bodySecret, secret));
    if (!ok) return json({ error: "Invalid signature" }, 401);

    const admin = getAdmin();

    await admin.from("webhook_logs").insert({
      source: "cakto",
      event_type: parsedBody?.event || "incoming",
      payload: parsedBody,
      status: "received",
    });

    const parsed = webhookSchema.safeParse(parsedBody);
    if (!parsed.success) return json({ error: "Invalid payload" }, 400);

    const { event, data } = parsed.data;
    const eventLower = event.toLowerCase();

    if (REFUND_EVENTS.has(eventLower)) {
      const existingUser = await findUserByEmail(admin, data.email);
      if (existingUser) {
        await admin.from("notifications").delete().eq("user_id", existingUser.id);
        await admin.from("support_requests").delete().eq("user_id", existingUser.id);
        await admin.from("account_stock_items").update({
          delivered_to: null, delivered_to_email: null, delivered_at: null, is_used: false,
        }).eq("delivered_to", existingUser.id);
        await admin.from("user_roles").delete().eq("user_id", existingUser.id);
        await admin.from("profiles").delete().eq("id", existingUser.id);
        await admin.auth.admin.deleteUser(existingUser.id);
      }
      return json({ success: true, message: "User deleted (refund)", email: data.email });
    }

    if (PURCHASE_EVENTS.has(eventLower)) {
      const DEFAULT_PASSWORD = "0000";
      const today = new Date().toISOString().slice(0, 10);
      const resolvedPlan = resolvePlan(data);

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: data.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: data.name || data.email },
      });

      if (authError) {
        if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
          const existingUser = await findUserByEmail(admin, data.email);
          if (existingUser) {
            await admin.auth.admin.updateUserById(existingUser.id, { password: DEFAULT_PASSWORD });
            await admin.from("profiles").update({
              plan: resolvedPlan,
              status: "active",
              must_change_password: true,
              purchase_date: today,
            }).eq("id", existingUser.id);
          }
          return json({ success: true, message: "User updated", plan: resolvedPlan });
        }
        return json({ error: authError.message }, 500);
      }

      if (authData.user) {
        await admin.from("profiles").update({
          plan: resolvedPlan,
          status: "active",
          must_change_password: true,
          purchase_date: today,
        }).eq("id", authData.user.id);
      }
      return json({ success: true, user_email: data.email, plan: resolvedPlan });
    }

    if (eventLower === "cancelled" || eventLower === "canceled") {
      const existingUser = await findUserByEmail(admin, data.email);
      if (existingUser) {
        await admin.from("profiles").update({ status: "inactive" }).eq("id", existingUser.id);
      }
      return json({ success: true, message: "User deactivated" });
    }

    return json({ success: true, message: "Event not handled" });
  } catch (error) {
    console.error("[cakto webhook] error:", error);
    return json({ error: "Internal server error" }, 500);
  }
}
