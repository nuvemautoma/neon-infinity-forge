import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, ArrowLeft, Trash2, Globe, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clonePage } from "@/lib/clone.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/cloner")({
  component: ClonerListPage,
  head: () => ({ meta: [{ title: "Clonador — Infinity I.A" }] }),
});

interface ClonedPage {
  id: string;
  name: string;
  source_url: string | null;
  updated_at: string;
}

function ClonerListPage() {
  const navigate = useNavigate();
  const cloneFn = useServerFn(clonePage);
  const [userId, setUserId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [pages, setPages] = useState<ClonedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      setUserId(user.id);

      const [{ data: profile }, { data: settings }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("plan").eq("id", user.id).single(),
        supabase.from("site_settings").select("cloner_allowed_plans").maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const isAdmin = (roles || []).some((r) => r.role === "admin");
      const plan = profile?.plan || "basic";
      const planList = (settings as any)?.cloner_allowed_plans || ["standard"];
      setAllowed(isAdmin || planList.includes(plan));

      const { data } = await supabase
        .from("cloned_pages")
        .select("id,name,source_url,updated_at")
        .order("updated_at", { ascending: false });
      setPages(data || []);
      setLoading(false);
    })();
  }, [navigate]);

  const create = async () => {
    if (!userId) return;
    if (!name.trim()) return toast.error("Dê um nome para a página");
    setCreating(true);
    try {
      let html = "";
      if (url.trim()) {
        const r: any = await cloneFn({ data: { url: url.trim() } });
        if (!r?.ok) throw new Error(r?.error || "Falha ao clonar");
        html = r.html;
      }
      const { data, error } = await supabase
        .from("cloned_pages")
        .insert({ user_id: userId, name: name.trim(), source_url: url.trim() || null, editor_data: { __html: html } })
        .select("id")
        .single();
      if (error) throw error;
      navigate({ to: "/cloner/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta página?")) return;
    await supabase.from("cloned_pages").delete().eq("id", id);
    setPages((p) => p.filter((x) => x.id !== id));
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6 text-center">
        <Toaster position="top-center" richColors />
        <div className="glass rounded-2xl p-8 max-w-md">
          <h1 className="text-xl font-bold mb-2">Recurso bloqueado</h1>
          <p className="text-muted-foreground mb-4">Seu plano atual não tem acesso ao Clonador de Páginas.</p>
          <Link to="/dashboard" className="text-primary underline">Voltar ao dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="font-bold text-foreground">Clonador de Páginas</h1>
          <button onClick={() => setOpen(true)} className="gradient-neon px-3 py-2 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow">
            <Plus className="w-4 h-4" /> Nova página
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {pages.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma página ainda. Clique em "Nova página" para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((p) => (
              <div key={p.id} className="glass rounded-2xl p-5 group">
                <h3 className="font-bold text-foreground truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground truncate mt-1">{p.source_url || "Em branco"}</p>
                <p className="text-xs text-muted-foreground mt-1">Atualizado em {new Date(p.updated_at).toLocaleString("pt-BR")}</p>
                <div className="flex gap-2 mt-4">
                  <Link to="/cloner/$id" params={{ id: p.id }} className="flex-1 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center gap-2">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Link>
                  <button onClick={() => remove(p.id)} className="px-3 py-2 rounded-lg border border-destructive/40 text-destructive text-sm">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-foreground">Nova página clonada</h2>
            <label className="block text-sm text-muted-foreground mb-1">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mb-4 bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Minha landing" />
            <label className="block text-sm text-muted-foreground mb-1">URL para clonar (opcional)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full mb-4 bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="https://exemplo.com" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm">Cancelar</button>
              <button onClick={create} disabled={creating} className="gradient-neon px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground flex items-center gap-2 disabled:opacity-50">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Clonando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
