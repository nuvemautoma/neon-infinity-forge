import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const VAPID_PUBLIC = "BKSV5JP0qRPTpXrtgvx6ZlebrkiDVGsTAczHeI76DC-A1MbL70YbYy1Dodk9e5ujvz82RrYVLfNvjPL1AjUF3Yc";

// Endpoint público chamado por pg_cron a cada minuto
export const Route = createFileRoute("/api/public/hooks/agenda-tick")({
  server: {
    handlers: {
      POST: async () => {
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (!privateKey) {
          return new Response(JSON.stringify({ ok: false, error: "VAPID_PRIVATE_KEY missing" }), { status: 500 });
        }
        webpush.setVapidDetails("mailto:suporte@infinity-ia.app", VAPID_PUBLIC, privateKey);

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // alvo: agora + 30min, em horário de São Paulo (UTC-3)
        const now = new Date();
        const target = new Date(now.getTime() + 30 * 60 * 1000);
        const sp = new Date(target.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const dow = sp.getDay(); // 0..6
        const hh = String(sp.getHours()).padStart(2, "0");
        const mm = String(sp.getMinutes()).padStart(2, "0");
        const timeStr = `${hh}:${mm}:00`;

        const { data: events } = await supabase
          .from("agenda_events")
          .select("*")
          .eq("is_active", true)
          .eq("notify_enabled", true)
          .eq("time_of_day", timeStr);

        const matched = (events || []).filter((e: any) => (e.days_of_week as number[])?.includes(dow));
        let sent = 0;
        const errors: string[] = [];

        for (const ev of matched) {
          // dedupe por minuto-alvo
          const scheduledFor = new Date(target);
          scheduledFor.setSeconds(0, 0);
          const { error: logErr } = await supabase
            .from("agenda_sent_log")
            .insert({ event_id: ev.id, user_id: ev.user_id, scheduled_for: scheduledFor.toISOString() });
          if (logErr) continue; // já enviado

          const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", ev.user_id);

          for (const s of subs || []) {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({
                  title: `⏰ Em 30 min: ${ev.title}`,
                  body: ev.description || "Hora de se preparar!",
                  url: "/agenda",
                })
              );
              sent++;
            } catch (e: any) {
              errors.push(`${s.endpoint.slice(-12)}: ${e?.statusCode || e?.message}`);
              // limpa subs inválidas
              if (e?.statusCode === 404 || e?.statusCode === 410) {
                await supabase.from("push_subscriptions").delete().eq("id", s.id);
              }
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, matched: matched.length, sent, errors }), {
          headers: { "content-type": "application/json" },
        });
      },
      GET: async () => new Response("agenda-tick alive"),
    },
  },
});
