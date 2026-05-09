import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Package, Users, Share2, Settings, LogOut, Plus, Pencil, Trash2, Eye, EyeOff, Star, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { toast } from "sonner";
import { Toaster } from "sonner";

export const Route = createFileRoute("/acsadmin")({
  component: AdminPanel,
  head: () => ({ meta: [{ title: "Admin — Infinity I.A" }] }),
});

type Tab = "dashboard" | "accounts" | "users" | "affiliates" | "settings";

function AdminPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const admin = roles?.some((r) => r.role === "admin");
      if (!admin) { toast.error("Acesso negado"); navigate({ to: "/dashboard" }); return; }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAdmin();
  }, [navigate]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const sidebarItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "Contas", icon: Package },
    { id: "users", label: "Usuários", icon: Users },
    { id: "affiliates", label: "Afiliados", icon: Share2 },
    { id: "settings", label: "Personalização", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Toaster position="top-right" theme="dark" />

      {/* Sidebar */}
      <aside className="w-64 glass-strong border-r border-border p-6 flex flex-col shrink-0 hidden md:flex">
        <div className="flex items-center gap-3 mb-8">
          <InfinityLogo size={32} />
          <div>
            <p className="font-bold text-foreground text-sm">INFINITY I.A</p>
            <p className="text-xs text-primary">ADMIN</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === item.id ? "gradient-neon text-primary-foreground neon-glow" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/acess" }))} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
          <LogOut className="w-5 h-5" /> Sair
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {tab === "dashboard" && <AdminDashboard />}
        {tab === "accounts" && <AdminAccounts />}
        {tab === "users" && <AdminUsers />}
        {tab === "affiliates" && <AdminAffiliates />}
        {tab === "settings" && <AdminSettings />}
      </main>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState({ accounts: 0, users: 0, affiliates: 0 });

  useEffect(() => {
    const load = async () => {
      const [a, u, af] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("affiliate_links").select("id", { count: "exact", head: true }),
      ]);
      setStats({ accounts: a.count || 0, users: u.count || 0, affiliates: af.count || 0 });
    };
    load();
  }, []);

  const cards = [
    { label: "Total de Contas", value: stats.accounts, icon: Package },
    { label: "Usuários Ativos", value: stats.users, icon: Users },
    { label: "Afiliados", value: stats.affiliates, icon: Share2 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Visão geral da plataforma</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-neon flex items-center justify-center">
                <c.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{c.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AdminAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "IA", email: "", password: "", main_link: "", observations: "", image_url: "", status: "active" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
    setAccounts(data || []);
  };

  const save = async () => {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    if (editId) {
      await supabase.from("accounts").update(form).eq("id", editId);
      toast.success("Conta atualizada!");
    } else {
      await supabase.from("accounts").insert(form);
      toast.success("Conta criada!");
    }
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", category: "IA", email: "", password: "", main_link: "", observations: "", image_url: "", status: "active" });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("accounts").delete().eq("id", id);
    toast.success("Conta removida!");
    load();
  };

  const edit = (a: any) => {
    setForm({ name: a.name, category: a.category, email: a.email || "", password: a.password || "", main_link: a.main_link || "", observations: a.observations || "", image_url: a.image_url || "", status: a.status });
    setEditId(a.id);
    setShowForm(true);
  };

  const toggleHidden = async (id: string, hidden: boolean) => {
    await supabase.from("accounts").update({ is_hidden: !hidden }).eq("id", id);
    load();
  };

  const toggleFeatured = async (id: string, featured: boolean) => {
    await supabase.from("accounts").update({ is_featured: !featured }).eq("id", id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Contas</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", category: "IA", email: "", password: "", main_link: "", observations: "", image_url: "", status: "active" }); }} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow">
          <Plus className="w-4 h-4" /> Nova Conta
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Nome", key: "name", type: "text" },
              { label: "Categoria", key: "category", type: "text" },
              { label: "Email", key: "email", type: "email" },
              { label: "Senha", key: "password", type: "text" },
              { label: "Link Principal", key: "main_link", type: "url" },
              { label: "Imagem URL", key: "image_url", type: "url" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
            <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 h-20 resize-none" />
          </div>
          <div className="flex gap-3">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-4 py-2 rounded-xl bg-input border border-border text-foreground text-sm">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
            <button onClick={save} className="gradient-neon px-6 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow">{editId ? "Salvar" : "Criar"}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-6 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border">Cancelar</button>
          </div>
        </motion.div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Categoria</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-foreground font-medium">{a.name}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{a.category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${a.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {a.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => edit(a)} className="p-2 rounded-lg hover:bg-accent transition-colors"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => toggleHidden(a.id, a.is_hidden)} className="p-2 rounded-lg hover:bg-accent transition-colors">{a.is_hidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}</button>
                    <button onClick={() => toggleFeatured(a.id, a.is_featured)} className="p-2 rounded-lg hover:bg-accent transition-colors"><Star className={`w-4 h-4 ${a.is_featured ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} /></button>
                    <button onClick={() => remove(a.id)} className="p-2 rounded-lg hover:bg-accent transition-colors"><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma conta cadastrada.</p>}
      </div>
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("profiles").update({ status }).eq("id", id);
    toast.success("Status atualizado!");
    load();
  };

  const updatePlan = async (id: string, plan: string) => {
    await supabase.from("profiles").update({ plan }).eq("id", id);
    toast.success("Plano atualizado!");
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Usuários</h1>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Plano</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-foreground font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3">
                  <select value={u.plan} onChange={(e) => updatePlan(u.id, e.target.value)} className="px-2 py-1 rounded-lg bg-input border border-border text-foreground text-xs">
                    <option value="basic">Básico</option>
                    <option value="premium">Premium</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${u.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {u.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => updateStatus(u.id, u.status === "active" ? "blocked" : "active")} className="px-3 py-1 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground transition-colors">
                    {u.status === "active" ? "Bloquear" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</p>}
      </div>
    </div>
  );
}

function AdminAffiliates() {
  const [links, setLinks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", commission: "", affiliate_url: "", image_url: "" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("affiliate_links").select("*").order("sort_order");
    setLinks(data || []);
  };

  const save = async () => {
    if (!form.name || !form.affiliate_url) { toast.error("Nome e URL obrigatórios"); return; }
    await supabase.from("affiliate_links").insert(form);
    toast.success("Link adicionado!");
    setShowForm(false);
    setForm({ name: "", description: "", commission: "", affiliate_url: "", image_url: "" });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("affiliate_links").delete().eq("id", id);
    toast.success("Link removido!");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Afiliados</h1>
        <button onClick={() => setShowForm(true)} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow">
          <Plus className="w-4 h-4" /> Novo Link
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Nome", key: "name" },
              { label: "Comissão", key: "commission" },
              { label: "URL do Afiliado", key: "affiliate_url" },
              { label: "Imagem URL", key: "image_url" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex gap-3">
            <button onClick={save} className="gradient-neon px-6 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow">Criar</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2 rounded-xl text-sm text-muted-foreground border border-border">Cancelar</button>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {links.map((l) => (
          <div key={l.id} className="glass rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-neon flex items-center justify-center">
                {l.image_url ? <img src={l.image_url} alt={l.name} className="w-full h-full object-cover rounded-xl" /> : <Share2 className="w-6 h-6 text-primary-foreground" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">{l.name}</p>
                <p className="text-sm text-muted-foreground">Comissão: {l.commission || "N/A"}</p>
              </div>
            </div>
            <button onClick={() => remove(l.id)} className="p-2 rounded-lg hover:bg-accent transition-colors"><Trash2 className="w-4 h-4 text-destructive" /></button>
          </div>
        ))}
        {links.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum link de afiliado cadastrado.</p>}
      </div>
    </div>
  );
}

function AdminSettings() {
  const [settings, setSettings] = useState({ site_name: "", primary_color: "#00B4FF", secondary_color: "#7A00FF", background_color: "#0B0F19", landing_html: "" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("site_settings").select("*").limit(1).single();
    if (data) setSettings({
      site_name: data.site_name || "",
      primary_color: data.primary_color || "#00B4FF",
      secondary_color: data.secondary_color || "#7A00FF",
      background_color: data.background_color || "#0B0F19",
      landing_html: (data as any).landing_html || "",
    });
  };

  const save = async () => {
    const { data: existing } = await supabase.from("site_settings").select("id").limit(1).single();
    if (existing) {
      await supabase.from("site_settings").update(settings).eq("id", existing.id);
    }
    toast.success("Configurações salvas!");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Personalização</h1>
      <div className="glass rounded-2xl p-6 space-y-6 max-w-3xl">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome do site</label>
          <input value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        {[
          { label: "Cor primária", key: "primary_color" },
          { label: "Cor secundária", key: "secondary_color" },
          { label: "Cor de fundo", key: "background_color" },
        ].map((c) => (
          <div key={c.key} className="flex items-center gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{c.label}</label>
              <input value={(settings as any)[c.key]} onChange={(e) => setSettings({ ...settings, [c.key]: e.target.value })} className="w-40 px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <input type="color" value={(settings as any)[c.key]} onChange={(e) => setSettings({ ...settings, [c.key]: e.target.value })} className="w-10 h-10 rounded-xl border-0 cursor-pointer" />
          </div>
        ))}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            HTML da Landing Page (rota /) — deixe vazio para usar a landing padrão. As alterações aparecem em tempo real.
          </label>
          <textarea
            value={settings.landing_html}
            onChange={(e) => setSettings({ ...settings, landing_html: e.target.value })}
            placeholder="<!DOCTYPE html><html>...</html>  ou trecho HTML/CSS"
            spellCheck={false}
            className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-xs font-mono h-96 resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button onClick={save} className="gradient-neon px-8 py-3 rounded-xl font-semibold text-primary-foreground neon-glow w-full">
          Salvar alterações
        </button>
      </div>
    </div>
  );
}
