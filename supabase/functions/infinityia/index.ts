// Edge Function: infinityia
// Webhook de produção da Cakto - cria/atualiza usuários conforme o plano comprado.
// Endpoint público: https://tsajcuqmlopidkaymntj.supabase.co/functions/v1/infinityia

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-cakto-signature",
};

const VALID_PLANS = new Set(["plus", "enterprise"]);
const REFUND_EVENTS = new Set([
  "refunded", "refund", "chargeback", "charged_back",
  "dispute", "disputed", "reembolso", "estorno",
]);
const PURCHASE_EVENTS = new Set([
  "purchase", "approved", "paid", "purchase_approved", "compra_aprovada",
  "subscription_renewed", "assinatura_renovada", "renewed",
]);
const CANCEL_EVENTS = new Set([
  "cancelled", "canceled", "subscription_cancelled", "assinatura_cancelada",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function inList(env: string | undefined): string[] {
  return (env || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function resolvePlan(data: {
  plan?: string; product_id?: string; offer_id?: string; product_name?: string;
}): string {
  const explicit = (data.plan || "").toLowerCase().trim();
  if (VALID_PLANS.has(explicit)) return explicit;

  const ids = [data.product_id, data.offer_id].filter(Boolean).map((s) => String(s).trim());
  const plusIds = [...inList(Deno.env.get("CAKTO_PRODUCT_PLUS")), ...inList(Deno.env.get("CAKTO_OFFER_PLUS"))];
  const entIds = [...inList(Deno.env.get("CAKTO_PRODUCT_ENTERPRISE")), ...inList(Deno.env.get("CAKTO_OFFER_ENTERPRISE"))];

  if (ids.some((i) => entIds.includes(i))) return "enterprise";
  if (ids.some((i) => plusIds.includes(i))) return "plus";

  const name = (data.product_name || "").toLowerCase();
  if (name.includes("enterprise")) return "enterprise";
  if (name.includes("plus")) return "plus";
  return "plus";
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  const sig = signature.replace(/^sha256=/, "").trim();
  return safeEq(sig, expected);
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function findUserByEmail(admin: ReturnType<typeof getAdmin>, email: string) {
  // pagina caso haja muitos usuários
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!data || data.users.length < 200) break;
  }
  return null;
}

function computeExpiresAt(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let rawBody = "";
  try {
    rawBody = await req.text();
    const secret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
    if (!secret) {
      console.error("[infinityia] CAKTO_WEBHOOK_SECRET not configured");
      return json({ error: "Webhook not configured" }, 503);
    }

    const url = new URL(req.url);
    const headerSig = req.headers.get("x-webhook-signature") || req.headers.get("x-cakto-signature");
    const querySecret = url.searchParams.get("secret");

    let parsedBody: any = {};
    try { parsedBody = JSON.parse(rawBody); } catch { /* ignore */ }
    const bodySecret = parsedBody?.secret;

    const sigOk = await verifySignature(rawBody, headerSig, secret);
    const ok =
      sigOk ||
      (typeof querySecret === "string" && safeEq(querySecret, secret)) ||
      (typeof bodySecret === "string" && safeEq(bodySecret, secret));

    if (!ok) {
      console.warn("[infinityia] invalid signature/secret");
      return json({ error: "Invalid signature" }, 401);
    }

    const admin = getAdmin();

    // log de recebimento
    await admin.from("webhook_logs").insert({
      source: "cakto",
      event_type: parsedBody?.event || "incoming",
      payload: parsedBody,
      status: "received",
    });

    const event = String(parsedBody?.event || "").toLowerCase().trim();
    const data = parsedBody?.data || {};
    const email = String(data?.email || "").trim().toLowerCase();

    if (!event || !email) {
      return json({ error: "Invalid payload: 'event' and 'data.email' required" }, 400);
    }

    // REFUND => deletar conta
    if (REFUND_EVENTS.has(event)) {
      const existing = await findUserByEmail(admin, email);
      if (existing) {
        await admin.from("notifications").delete().eq("user_id", existing.id);
        await admin.from("support_requests").delete().eq("user_id", existing.id);
        await admin.from("account_stock_items").update({
          delivered_to: null, delivered_to_email: null, delivered_at: null, is_used: false,
        }).eq("delivered_to", existing.id);
        await admin.from("user_roles").delete().eq("user_id", existing.id);
        await admin.from("profiles").delete().eq("id", existing.id);
        await admin.auth.admin.deleteUser(existing.id);
      }
      await admin.from("webhook_logs").update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("source", "cakto").eq("event_type", parsedBody?.event).order("created_at", { ascending: false }).limit(1);
      return json({ success: true, action: "refund_deleted", email });
    }

    // CANCEL => desativar
    if (CANCEL_EVENTS.has(event)) {
      const existing = await findUserByEmail(admin, email);
      if (existing) {
        await admin.from("profiles").update({
          status: "inactive",
          expires_at: new Date().toISOString(),
        }).eq("id", existing.id);
      }
      return json({ success: true, action: "cancelled", email });
    }

    // PURCHASE / RENEW => criar ou atualizar
    if (PURCHASE_EVENTS.has(event)) {
      const DEFAULT_PASSWORD = "0000";
      const today = new Date().toISOString().slice(0, 10);
      const resolvedPlan = resolvePlan(data);
      const expiresAt = computeExpiresAt(30);

      const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: data.name || email },
      });

      if (createErr) {
        const msg = createErr.message || "";
        const isDuplicate = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
        if (!isDuplicate) {
          console.error("[infinityia] createUser error:", msg);
          return json({ error: msg }, 500);
        }
        const existing = await findUserByEmail(admin, email);
        if (!existing) return json({ error: "User exists but not found" }, 500);

        await admin.auth.admin.updateUserById(existing.id, { password: DEFAULT_PASSWORD });
        await admin.from("profiles").update({
          plan: resolvedPlan,
          status: "active",
          must_change_password: true,
          purchase_date: today,
          expires_at: expiresAt,
        }).eq("id", existing.id);

        return json({ success: true, action: "renewed", email, plan: resolvedPlan, expires_at: expiresAt });
      }

      if (createRes?.user) {
        await admin.from("profiles").update({
          plan: resolvedPlan,
          status: "active",
          must_change_password: true,
          purchase_date: today,
          expires_at: expiresAt,
        }).eq("id", createRes.user.id);
      }
      return json({ success: true, action: "created", email, plan: resolvedPlan, expires_at: expiresAt });
    }

    return json({ success: true, action: "ignored", event });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[infinityia] fatal:", msg, "body:", rawBody.slice(0, 500));
    try {
      const admin = getAdmin();
      await admin.from("webhook_logs").insert({
        source: "cakto",
        event_type: "error",
        payload: { error: msg, raw: rawBody.slice(0, 2000) },
        status: "error",
      });
    } catch { /* ignore */ }
    return json({ error: "Internal server error", detail: msg }, 500);
  }
});
