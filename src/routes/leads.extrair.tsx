import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, Star, Phone, Mail, Globe, MapPin, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { FloatingSupportButton } from "@/components/FloatingSupportButton";
import { extractLeads } from "@/lib/leads-extract.functions";
import type { LeadResult } from "@/lib/leads-extract.functions";
import { NICHE_SUGGESTIONS, BR_STATES, COUNTRIES } from "@/components/Leads/types";
import { Combobox } from "@/components/Leads/Combobox";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/leads/extrair")({
  component: ExtractPage,
  head: () => ({ meta: [{ title: "Extrair Leads — Infinity I.A" }] }),
});

function ExtractPage() {
  const navigate = useNavigate();
  const extract = useServerFn(extractLeads);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasGoogleKey, setHasGoogleKey] = useState(false);
  const [defaultColumnId, setDefaultColumnId] = useState<string | null>(null);

  const [form, setForm] = useState({
    country: "Brasil", state: "", city: "", niche: "", name: "",
    useGoogle: false, enrichEmail: true,
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LeadResult[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      setUserId(user.id);

      const [settings, cols] = await Promise.all([
        supabase.from("site_settings_public" as any).select("has_google_places_key").maybeSingle(),
        supabase.from("lead_columns").select("id, position").eq("user_id", user.id).order("position").limit(1),
      ]);
      setHasGoogleKey(!!(settings.data as any)?.has_google_places_key);
      if (cols.data?.[0]) setDefaultColumnId(cols.data[0].id);
    })();
  }, [navigate]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city.trim()) { toast.error("Cidade é obrigatória"); return; }
    setLoading(true); setResults([]); setMeta(null);
    try {
      const r = await extract({ data: { ...form, limit: 80 } });
      setResults(r.results);
      setMeta(r.meta);
      if (!r.results.length) toast.warning("Nenhum resultado encontrado");
      else toast.success(`${r.results.length} resultados — ${r.meta.emailsFound} emails encontrados`);
    } catch (e: any) {
      toast.error(e?.message || "Falha na extração");
    } finally { setLoading(false); }
  };

  const saveLead = async (r: LeadResult) => {
    if (!userId) return;
    let colId = defaultColumnId;
    if (!colId) {
      const { data } = await supabase.from("lead_columns").select("id").eq("user_id", userId).order("position").limit(1).maybeSingle();
      colId = data?.id || null;
      if (!colId) {
        const ins = await supabase.from("lead_columns").insert({ user_id: userId, name: "Novo", color: "#00B4FF", position: 0 }).select("id").single();
        colId = ins.data?.id || null;
      }
      setDefaultColumnId(colId);
    }
    const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("column_id", colId!);
    const { error } = await supabase.from("leads").insert({
      user_id: userId,
      column_id: colId,
      position: count || 0,
      name: r.name,
      phone: r.phone,
      email: r.email,
      website: r.website,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      rating: r.rating,
      reviews_count: r.reviews_count,
      photo_url: r.photo_url,
      description: r.description,
      category: r.category,
      source: r.source,
      external_id: r.external_id,
    });
    if (error) { toast.error(error.message); return; }
    setSavedIds(new Set([...savedIds, r.external_id]));
    toast.success(`${r.name} salvo`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" theme="dark" />
      <FloatingSupportButton />
      <header className="border-b border-border glass sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/leads" className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5 text-foreground" /></Link>
          <h1 className="text-lg font-bold text-foreground flex-1">Extrair leads</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1">Encontre comércios para prospectar</h2>
          <p className="text-sm text-muted-foreground">Informe a localização e o nicho. O sistema busca em mapas públicos e tenta capturar email automaticamente.</p>
        </div>

        <form onSubmit={onSearch} className="glass rounded-2xl p-5 md:p-6 mb-6 space-y-5 border border-border">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-3">📍 Onde buscar</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">País</label>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Estado</label>
                <input list="states" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Ex: São Paulo" className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors" />
                <datalist id="states">{BR_STATES.map((s) => <option key={s.uf} value={s.name} />)}</datalist>
              </div>
              <div>
                <label className="text-xs mb-1.5 block"><span className="text-foreground font-semibold">Cidade</span> <span className="text-destructive">*</span></label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required placeholder="Ex: Campinas" className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-3">🎯 O que buscar</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1.5 block"><span className="text-foreground font-semibold">Nicho</span> <span className="text-muted-foreground">(o que vende)</span></label>
                <input list="niches" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="restaurante, barbearia, academia…" className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors" />
                <datalist id="niches">{NICHE_SUGGESTIONS.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
              <div>
                <label className="text-xs mb-1.5 block"><span className="text-foreground font-semibold">Nome</span> <span className="text-muted-foreground">(opcional)</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Filtrar por nome do comércio" className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.enrichEmail} onChange={(e) => setForm({ ...form, enrichEmail: e.target.checked })} className="accent-primary w-4 h-4" />
              Buscar emails nos sites
            </label>
            {hasGoogleKey && (
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={form.useGoogle} onChange={(e) => setForm({ ...form, useGoogle: e.target.checked })} className="accent-primary w-4 h-4" />
                Incluir Google Places (mais qualidade)
              </label>
            )}
            <button disabled={loading} type="submit" className="ml-auto px-8 py-3 rounded-xl gradient-neon text-primary-foreground text-sm font-bold neon-glow flex items-center gap-2 disabled:opacity-50 hover:scale-[1.02] transition-transform">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Buscando…" : "Buscar leads"}
            </button>
          </div>
        </form>

        {meta && (
          <div className="text-xs text-muted-foreground mb-4">
            {meta.total} resultados · {meta.emailsFound} emails encontrados {meta.googleUsed && "· Google Places usado"}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((r) => (
            <ResultCard key={r.external_id} r={r} saved={savedIds.has(r.external_id)} onSave={() => saveLead(r)} />
          ))}
        </div>

        {!loading && !results.length && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Preencha os campos e clique em Buscar</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ r, saved, onSave }: { r: LeadResult; saved: boolean; onSave: () => void }) {
  return (
    <div className="glass rounded-2xl border border-border overflow-hidden flex flex-col">
      {r.photo_url ? (
        <img src={r.photo_url} alt="" className="w-full h-32 object-cover" />
      ) : (
        <div className="w-full h-32 bg-primary/10 grid place-items-center text-primary text-3xl font-bold">{r.name.charAt(0).toUpperCase()}</div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2 mb-2">
          <h3 className="text-sm font-bold text-foreground flex-1">{r.name}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase font-semibold">{r.source}</span>
        </div>
        {r.rating != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-foreground font-semibold">{r.rating}</span>
            {r.reviews_count != null && <span>({r.reviews_count})</span>}
          </div>
        )}
        <div className="space-y-1 text-xs text-muted-foreground flex-1">
          {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 hover:text-primary truncate"><Phone className="w-3 h-3 shrink-0" />{r.phone}</a>}
          {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 hover:text-primary truncate"><Mail className="w-3 h-3 shrink-0" />{r.email}</a>}
          {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary truncate"><Globe className="w-3 h-3 shrink-0" />{r.website.replace(/^https?:\/\//, "")}</a>}
          {r.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(r.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 hover:text-primary"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span className="line-clamp-2">{r.address}</span></a>}
          {r.description && <p className="text-xs italic line-clamp-2 mt-1">{r.description}</p>}
        </div>
        <button disabled={saved} onClick={onSave} className={`mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${saved ? "bg-green-500/15 text-green-400 cursor-default" : "gradient-neon text-primary-foreground neon-glow"}`}>
          <Plus className="w-3.5 h-3.5" />{saved ? "Salvo" : "Salvar lead"}
        </button>
      </div>
    </div>
  );
}
