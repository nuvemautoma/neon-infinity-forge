import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

/**
 * Resolve which plan to deliver based on the Cakto checkout payload.
 * Priority:
 *  1. Explicit `plan` field if it's a known value (plus | enterprise)
 *  2. product_id / offer_id matched against env mappings
 *     - CAKTO_PRODUCT_PLUS / CAKTO_OFFER_PLUS  (comma-separated allowed)
 *     - CAKTO_PRODUCT_ENTERPRISE / CAKTO_OFFER_ENTERPRISE
 *  3. product_name keyword fallback ("enterprise" / "plus")
 *  4. Default: "plus"
 */
function resolvePlan(data: { plan?: string; product_id?: string; offer_id?: string; product_name?: string }): string {
  const explicit = (data.plan || "").toLowerCase().trim();
  if (VALID_PLANS.has(explicit)) return explicit;

  const ids = [data.product_id, data.offer_id].filter(Boolean).map((s) => String(s).trim());
  const inList = (env: string | undefined) =>
    (env || "").split(",").map((s) => s.trim()).filter(Boolean);

  const plusIds = [...inList(process.env.CAKTO_PRODUCT_PLUS), ...inList(process.env.CAKTO_OFFER_PLUS)];
  const entIds = [...inList(process.env.CAKTO_PRODUCT_ENTERPRISE), ...inList(process.env.CAKTO_OFFER_ENTERPRISE)];

  if (ids.some((i) => entIds.includes(i))) return "enterprise";
  if (ids.some((i) => plusIds.includes(i))) return "plus";

  const name = (data.product_name || "").toLowerCase();
  if (name.includes("enterprise")) return "enterprise";
  if (name.includes("plus")) return "plus";

  return "plus";
}

const REFUND_EVENTS = new Set([
  "refunded",
  "refund",
  "chargeback",
  "charged_back",
  "dispute",
  "disputed",
  "reembolso",
  "estorno",
]);

const PURCHASE_EVENTS = new Set(["purchase", "approved", "paid", "purchase_approved", "compra_aprovada"]);

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

async function findUserByEmail(email: string) {
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  return data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

export const Route = createFileRoute("/api/public/webhook/cakto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = await request.text();
          const secret = process.env.CAKTO_WEBHOOK_SECRET;

          // Auth: HMAC header OR ?secret= query OR body.secret
          const url = new URL(request.url);
          const headerSig = request.headers.get("x-webhook-signature") || request.headers.get("x-cakto-signature");
          const querySecret = url.searchParams.get("secret");
          let parsedBody: any = {};
          try { parsedBody = JSON.parse(rawBody); } catch {}
          const bodySecret = parsedBody?.secret;

          if (!secret) {
            console.error("[cakto webhook] CAKTO_WEBHOOK_SECRET not configured — rejecting request");
            return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
          }
          const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
          const ok =
            verifySignature(rawBody, headerSig, secret) ||
            (typeof querySecret === "string" && safeEq(querySecret, secret)) ||
            (typeof bodySecret === "string" && safeEq(bodySecret, secret));
          if (!ok) {
            return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { "Content-Type": "application/json" } });
          }

          await supabaseAdmin.from("webhook_logs").insert({
            source: "cakto",
            event_type: parsedBody?.event || "incoming",
            payload: parsedBody,
            status: "received",
          });

          const parsed = webhookSchema.safeParse(parsedBody);
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { "Content-Type": "application/json" } });
          }

          const { event, data } = parsed.data;
          const eventLower = event.toLowerCase();

          // ===== Refund / Chargeback => DELETE user =====
          if (REFUND_EVENTS.has(eventLower)) {
            const existingUser = await findUserByEmail(data.email);
            if (existingUser) {
              await supabaseAdmin.from("notifications").delete().eq("user_id", existingUser.id);
              await supabaseAdmin.from("support_requests").delete().eq("user_id", existingUser.id);
              await supabaseAdmin.from("account_stock_items").update({ delivered_to: null, delivered_to_email: null, delivered_at: null, is_used: false }).eq("delivered_to", existingUser.id);
              await supabaseAdmin.from("user_roles").delete().eq("user_id", existingUser.id);
              await supabaseAdmin.from("profiles").delete().eq("id", existingUser.id);
              await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
            }
            await supabaseAdmin.from("webhook_logs").update({ status: "processed", processed_at: new Date().toISOString() }).eq("payload->>email", data.email).order("created_at", { ascending: false }).limit(1);
            return new Response(JSON.stringify({ success: true, message: "User deleted due to refund/chargeback", email: data.email }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          // ===== Purchase / Approved =====
          if (PURCHASE_EVENTS.has(eventLower)) {
            const DEFAULT_PASSWORD = "0000";
            const today = new Date().toISOString().slice(0, 10);
            const resolvedPlan = resolvePlan(data);

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: data.email,
              password: DEFAULT_PASSWORD,
              email_confirm: true,
              user_metadata: { full_name: data.name || data.email },
            });

            if (authError) {
              if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
                const existingUser = await findUserByEmail(data.email);
                if (existingUser) {
                  await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: DEFAULT_PASSWORD });
                  await supabaseAdmin.from("profiles").update({
                    plan: resolvedPlan,
                    status: "active",
                    must_change_password: true,
                    purchase_date: today,
                  }).eq("id", existingUser.id);
                }
                return new Response(JSON.stringify({ success: true, message: "User updated", plan: resolvedPlan }), { status: 200, headers: { "Content-Type": "application/json" } });
              }
              return new Response(JSON.stringify({ error: authError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
            }

            if (authData.user) {
              await supabaseAdmin.from("profiles").update({
                plan: resolvedPlan,
                status: "active",
                must_change_password: true,
                purchase_date: today,
              }).eq("id", authData.user.id);
            }

            return new Response(JSON.stringify({ success: true, user_email: data.email, plan: resolvedPlan }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (eventLower === "cancelled" || eventLower === "canceled") {
            const existingUser = await findUserByEmail(data.email);
            if (existingUser) {
              await supabaseAdmin.from("profiles").update({ status: "inactive" }).eq("id", existingUser.id);
            }
            return new Response(JSON.stringify({ success: true, message: "User deactivated" }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          return new Response(JSON.stringify({ success: true, message: "Event not handled" }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (error) {
          console.error("Webhook error:", error);
          return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
