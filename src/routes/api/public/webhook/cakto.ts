import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const webhookSchema = z.object({
  event: z.string().min(1).max(100),
  data: z.object({
    email: z.string().email().max(255),
    name: z.string().min(1).max(255).optional(),
    plan: z.string().min(1).max(50).optional(),
    product_id: z.string().max(100).optional(),
  }),
});

export const Route = createFileRoute("/api/public/webhook/cakto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.text();

          // Log webhook
          await supabaseAdmin.from("webhook_logs").insert({
            source: "cakto",
            event_type: "incoming",
            payload: JSON.parse(body),
            status: "received",
          });

          const parsed = webhookSchema.safeParse(JSON.parse(body));
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { "Content-Type": "application/json" } });
          }

          const { event, data } = parsed.data;

          if (event === "purchase" || event === "approved") {
            const DEFAULT_PASSWORD = "0000";
            const today = new Date().toISOString().slice(0, 10);

            // Create user in Supabase Auth with default password
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: data.email,
              password: DEFAULT_PASSWORD,
              email_confirm: true,
              user_metadata: { full_name: data.name || data.email },
            });

            if (authError) {
              // User might already exist
              if (authError.message.includes("already been registered")) {
                const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = existingUsers?.users?.find((u) => u.email === data.email);
                if (existingUser) {
                  // Reset password to default and force change
                  await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: DEFAULT_PASSWORD });
                  await supabaseAdmin.from("profiles").update({
                    plan: data.plan || "basic",
                    status: "active",
                    must_change_password: true,
                    purchase_date: today,
                  }).eq("id", existingUser.id);
                }
                await supabaseAdmin.from("webhook_logs").update({ status: "processed", processed_at: new Date().toISOString() }).eq("payload->>email", data.email).order("created_at", { ascending: false }).limit(1);
                return new Response(JSON.stringify({ success: true, message: "User updated" }), { status: 200, headers: { "Content-Type": "application/json" } });
              }
              return new Response(JSON.stringify({ error: authError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
            }

            if (authData.user) {
              await supabaseAdmin.from("profiles").update({
                plan: data.plan || "basic",
                status: "active",
                must_change_password: true,
                purchase_date: today,
              }).eq("id", authData.user.id);
            }

            await supabaseAdmin.from("webhook_logs").update({ status: "processed", processed_at: new Date().toISOString() }).eq("payload->>email", data.email).order("created_at", { ascending: false }).limit(1);

            return new Response(JSON.stringify({ success: true, user_email: data.email }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (event === "cancelled" || event === "refunded") {
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find((u) => u.email === data.email);
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
