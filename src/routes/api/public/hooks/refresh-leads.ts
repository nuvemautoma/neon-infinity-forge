import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { enrichSitesBatch } from "@/lib/leads-extract.functions";

// Atualiza automaticamente os leads que têm site há mais de 2 dias.
// Reextrai email, telefone e imagem (og:image / favicon) e marca last_refreshed_at.
// Pensado para ser chamado por pg_cron a cada 2 dias.

const BATCH = 40;
const STALE_DAYS = 2;

export const Route = createFileRoute("/api/public/hooks/refresh-leads")({
  server: {
    handlers: {
      POST: async () => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE_KEY) {
          return new Response(JSON.stringify({ error: "missing supabase env" }), { status: 500 });
        }

        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

        // Pega leads com site, sem refresh recente
        const { data: rows, error } = await admin
          .from("leads")
          .select("id,website,email,phone,photo_url,last_refreshed_at")
          .not("website", "is", null)
          .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${cutoff}`)
          .order("last_refreshed_at", { ascending: true, nullsFirst: true })
          .limit(BATCH);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        const leads = rows ?? [];
        if (!leads.length) {
          return new Response(JSON.stringify({ success: true, refreshed: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const sites = Array.from(new Set(leads.map((l) => l.website!).filter(Boolean)));
        const infoMap = await enrichSitesBatch(sites);

        let updated = 0;
        const now = new Date().toISOString();
        for (const l of leads) {
          const info = l.website ? infoMap.get(l.website) : undefined;
          const patch: Record<string, unknown> = { last_refreshed_at: now };
          if (info) {
            if (info.email && info.email !== l.email) patch.email = info.email;
            if (info.phone && info.phone !== l.phone) patch.phone = info.phone;
            if (info.image && info.image !== l.photo_url) patch.photo_url = info.image;
          }
          const { error: upErr } = await admin.from("leads").update(patch).eq("id", l.id);
          if (!upErr) updated++;
        }

        return new Response(
          JSON.stringify({ success: true, scanned: leads.length, refreshed: updated }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
