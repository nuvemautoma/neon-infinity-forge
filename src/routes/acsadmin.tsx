import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Package, Users, Share2, Settings, LogOut, Plus, Pencil, Trash2, Eye, EyeOff, Star, Inbox, Bell, AlertTriangle, Boxes, ShieldAlert, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { HtmlAiPanel } from "@/components/HtmlAiPanel";
import { GrapesEditor } from "@/components/GrapesEditor";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/acsadmin")({
  component: AdminPanel,
  head: () => ({ meta: [{ title: "Admin — Infinity I.A" }] }),
});

type Tab = "dashboard" | "accounts" | "tools" | "stock" | "urgency" | "support" | "notifications" | "plans" | "users" | "affiliates" | "settings" | "danger";

const PLAN_OPTIONS = ["basic", "plus", "standard"] as const;

function AdminPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const admin = roles?.some((r) => r.role === "admin");
      if (!admin) { toast.error("Acesso negado"); navigate({ to: "/dashboard" }); return; }
      setLoading(false);
    };
    checkAdmin();
  }, [navigate]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const sidebarItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "Produtos", icon: Package },
    { id: "tools", label: "Ferramentas Excl.", icon: Wrench },
    { id: "stock", label: "Estoque", icon: Boxes },
    { id: "urgency", label: "Urgência", icon: AlertTriangle },
    { id: "support", label: "Solicitações", icon: Inbox },
    { id: "notifications", label: "Notificações", icon: Bell },
    { id: "plans", label: "Planos", icon: Star },
    { id: "users", label: "Usuários", icon: Users },
    { id: "affiliates", label: "Afiliados", icon: Share2 },
    { id: "settings", label: "Personalização", icon: Settings },
    { id: "danger", label: "Zona Perigosa", icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Toaster position="top-right" theme="dark" />

      <aside className="w-60 glass-strong border-r border-border p-4 flex-col shrink-0 hidden md:flex">
        <div className="flex items-center gap-3 mb-6 px-2">
          <InfinityLogo size={32} />
          <div>
            <p className="font-bold text-foreground text-sm">INFINITY I.A</p>
            <p className="text-xs text-primary">ADMIN</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === item.id ? "gradient-neon text-primary-foreground neon-glow" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/acess" }))} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all mt-2">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {/* Tab selector mobile */}
        <select value={tab} onChange={(e) => setTab(e.target.value as Tab)} className="md:hidden w-full mb-4 px-4 py-2 rounded-xl bg-input border border-border text-foreground">
          {sidebarItems.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        {tab === "dashboard" && <AdminDashboard />}
        {tab === "accounts" && <AdminAccounts kind="account" />}
        {tab === "tools" && <AdminAccounts kind="tool" />}
        {tab === "stock" && <AdminStock />}
        {tab === "urgency" && <AdminUrgency />}
        {tab === "support" && <AdminSupport />}
        {tab === "notifications" && <AdminNotifications />}
        {tab === "plans" && <AdminPlans />}
        {tab === "users" && <AdminUsers />}
        {tab === "affiliates" && <AdminAffiliates />}
        {tab === "settings" && <AdminSettings />}
        {tab === "danger" && <AdminDanger />}
      </main>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState({ accounts: 0, users: 0, support: 0, lowStock: 0 });

  useEffect(() => {
    const load = async () => {
      const [a, u, s] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("support_requests").select("id", { count: "exact", head: true }),
      ]);
      const { data: low } = await supabase.rpc as any;
      // calc low stock client-side
      const { data: accounts } = await supabase.from("accounts").select("id, unlimited_stock, delivery_type");
      const { data: stock } = await supabase.from("account_stock_items").select("account_id").is("delivered_to", null);
      const counts: Record<string, number> = {};
      (stock || []).forEach((s: any) => { counts[s.account_id] = (counts[s.account_id] || 0) + 1; });
      const lowCount = (accounts || []).filter((a: any) => !a.unlimited_stock && (counts[a.id] || 0) < 3).length;
      setStats({ accounts: a.count || 0, users: u.count || 0, support: s.count || 0, lowStock: lowCount });
    };
    load();
  }, []);

  const cards = [
    { label: "Produtos", value: stats.accounts, icon: Package },
    { label: "Usuários", value: stats.users, icon: Users },
    { label: "Solicitações abertas", value: stats.support, icon: Inbox },
    { label: "Estoque baixo/zero", value: stats.lowStock, icon: AlertTriangle },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Visão geral da plataforma</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

const emptyForm = {
  name: "", category: "IA", email: "", password: "", main_link: "", observations: "", image_url: "", status: "active",
  delivery_type: "shared", unlimited_stock: false, allowed_plans: ["basic", "plus", "standard"] as string[],
};

function AdminAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
    setAccounts(data || []);
  };

  const save = async () => {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    const payload = { ...form, unlimited_stock: form.delivery_type === "individual" ? false : form.unlimited_stock };
    if (editId) {
      const { error } = await supabase.from("accounts").update(payload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from("accounts").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Produto criado!");
    }
    setShowForm(false);
    setEditId(null);
    setForm({ ...emptyForm });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    await supabase.from("accounts").delete().eq("id", id);
    toast.success("Produto removido!");
    load();
  };

  const edit = (a: any) => {
    setForm({
      name: a.name, category: a.category, email: a.email || "", password: a.password || "",
      main_link: a.main_link || "", observations: a.observations || "", image_url: a.image_url || "",
      status: a.status, delivery_type: a.delivery_type || "shared",
      unlimited_stock: !!a.unlimited_stock, allowed_plans: a.allowed_plans || ["basic", "plus", "standard"],
    });
    setEditId(a.id);
    setShowForm(true);
  };

  const togglePlan = (p: string) => {
    setForm((f) => ({ ...f, allowed_plans: f.allowed_plans.includes(p) ? f.allowed_plans.filter((x) => x !== p) : [...f.allowed_plans, p] }));
  };

  const toggleHidden = async (id: string, hidden: boolean) => { await supabase.from("accounts").update({ is_hidden: !hidden }).eq("id", id); load(); };
  const toggleFeatured = async (id: string, featured: boolean) => { await supabase.from("accounts").update({ is_featured: !featured }).eq("id", id); load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyForm }); }} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Nome", key: "name", type: "text" },
              { label: "Categoria", key: "category", type: "text" },
              { label: "Email (compartilhado)", key: "email", type: "email" },
              { label: "Senha (compartilhado)", key: "password", type: "text" },
              { label: "Link Principal (compartilhado)", key: "main_link", type: "url" },
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
            <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm h-20 resize-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de entrega</label>
              <select value={form.delivery_type} onChange={(e) => setForm({ ...form, delivery_type: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm">
                <option value="shared">Compartilhado (mesmo acesso para todos)</option>
                <option value="individual">Individual (1 link/conta por usuário)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            {form.delivery_type === "shared" && (
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={form.unlimited_stock} onChange={(e) => setForm({ ...form, unlimited_stock: e.target.checked })} className="w-4 h-4 accent-primary" />
                  Estoque infinito
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Planos com acesso</label>
            <div className="flex gap-2 flex-wrap">
              {PLAN_OPTIONS.map((p) => (
                <button key={p} type="button" onClick={() => togglePlan(p)} className={`px-3 py-1.5 rounded-full text-xs uppercase font-medium border transition-all ${form.allowed_plans.includes(p) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
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
              <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Planos</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-foreground font-medium">{a.name}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                  {a.delivery_type === "individual" ? "👤 Individual" : a.unlimited_stock ? "♾️ Compartilhado" : "🔗 Compartilhado"}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs uppercase">{(a.allowed_plans || []).join(", ")}</td>
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
        {accounts.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum produto cadastrado.</p>}
      </div>
    </div>
  );
}

function AdminStock() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<string, { total: number; delivered: number }>>({});
  const [bulkOpen, setBulkOpen] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [viewItems, setViewItems] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: accs } = await supabase.from("accounts").select("*").order("name");
    setAccounts(accs || []);
    const { data: it } = await supabase.from("account_stock_items").select("account_id, delivered_to");
    const map: Record<string, { total: number; delivered: number }> = {};
    (it || []).forEach((i: any) => {
      if (!map[i.account_id]) map[i.account_id] = { total: 0, delivered: 0 };
      map[i.account_id].total++;
      if (i.delivered_to) map[i.account_id].delivered++;
    });
    setStock(map);
  };

  const addBulk = async () => {
    if (!bulkOpen || !bulkText.trim()) return;
    const items = bulkText.split(";").map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    const rows = items.map((content) => ({ account_id: bulkOpen, content }));
    const { error } = await supabase.from("account_stock_items").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${items.length} item(ns) adicionado(s)!`);
    setBulkOpen(null);
    setBulkText("");
    load();
  };

  const loadItems = async (accountId: string) => {
    const { data } = await supabase.from("account_stock_items").select("*").eq("account_id", accountId).order("created_at");
    setItems(data || []);
    setViewItems(accountId);
  };

  const removeItem = async (id: string) => {
    await supabase.from("account_stock_items").delete().eq("id", id);
    if (viewItems) loadItems(viewItems);
    load();
  };

  const clearAccountStock = async (accountId: string) => {
    if (!confirm("Limpar todos os itens de estoque deste produto?")) return;
    await supabase.from("account_stock_items").delete().eq("account_id", accountId);
    toast.success("Estoque limpo!");
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Estoque</h1>

      <div className="space-y-3">
        {accounts.map((a) => {
          const s = stock[a.id] || { total: 0, delivered: 0 };
          const available = s.total - s.delivered;
          const isLow = !a.unlimited_stock && available < 3;
          return (
            <div key={a.id} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-neon flex items-center justify-center text-primary-foreground font-bold">{a.name[0]}</div>
                  <div>
                    <p className="font-semibold text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.delivery_type === "individual" ? "Individual" : "Compartilhado"} · {(a.allowed_plans || []).join(", ").toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {a.unlimited_stock ? (
                    <span className="px-3 py-1 rounded-full text-xs bg-primary/20 text-primary font-medium">♾️ Infinito</span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isLow ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                      {available} disponível · {s.delivered} entregues
                    </span>
                  )}
                  <button onClick={() => { setBulkOpen(a.id); setBulkText(""); }} className="px-3 py-1.5 rounded-lg text-xs gradient-neon text-primary-foreground font-medium">+ Adicionar</button>
                  <button onClick={() => loadItems(a.id)} className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground">Ver itens</button>
                  <button onClick={() => clearAccountStock(a.id)} className="px-3 py-1.5 rounded-lg text-xs border border-destructive/40 text-destructive">Limpar</button>
                </div>
              </div>

              {bulkOpen === a.id && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Cole links/contas separados por <strong>;</strong> (ponto e vírgula)</p>
                  <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="https://link1.com;https://link2.com;..." className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm h-24 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <div className="flex gap-2">
                    <button onClick={addBulk} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground">Adicionar ao estoque</button>
                    <button onClick={() => setBulkOpen(null)} className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground">Cancelar</button>
                  </div>
                </div>
              )}

              {viewItems === a.id && (
                <div className="mt-4 max-h-72 overflow-y-auto space-y-1">
                  {items.length === 0 && <p className="text-xs text-muted-foreground py-2">Sem itens.</p>}
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-accent/30 text-xs">
                      <span className="text-foreground font-mono truncate flex-1">{i.content}</span>
                      <span className="text-muted-foreground shrink-0">{i.delivered_to_email ? `→ ${i.delivered_to_email}` : "disponível"}</span>
                      <button onClick={() => removeItem(i.id)} className="p-1 rounded hover:bg-accent"><Trash2 className="w-3 h-3 text-destructive" /></button>
                    </div>
                  ))}
                  <button onClick={() => setViewItems(null)} className="text-xs text-muted-foreground hover:text-foreground mt-2">Fechar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminUrgency() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: accs } = await supabase.from("accounts").select("*").eq("unlimited_stock", false);
    const { data: stock } = await supabase.from("account_stock_items").select("account_id").is("delivered_to", null);
    const counts: Record<string, number> = {};
    (stock || []).forEach((s: any) => { counts[s.account_id] = (counts[s.account_id] || 0) + 1; });
    const list = (accs || []).map((a: any) => ({ ...a, available: counts[a.id] || 0 })).filter((a: any) => a.available < 5).sort((a: any, b: any) => a.available - b.available);
    setItems(list);
  };

  const setUnlimited = async (id: string) => {
    await supabase.from("accounts").update({ unlimited_stock: true }).eq("id", id);
    toast.success("Marcado como infinito!");
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Urgência</h1>
      <p className="text-muted-foreground mb-6">Produtos com estoque baixo ou esgotado.</p>
      <div className="space-y-3">
        {items.length === 0 && <div className="glass rounded-2xl p-8 text-center text-muted-foreground">✅ Tudo em ordem!</div>}
        {items.map((a) => (
          <div key={a.id} className={`glass rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3 ${a.available === 0 ? "border border-red-500/40" : "border border-yellow-500/30"}`}>
            <div>
              <p className="font-semibold text-foreground">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.delivery_type === "individual" ? "Individual" : "Compartilhado"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${a.available === 0 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-300"}`}>
                {a.available === 0 ? "ESGOTADO" : `${a.available} restantes`}
              </span>
              {a.delivery_type !== "individual" && (
                <button onClick={() => setUnlimited(a.id)} className="px-3 py-1.5 rounded-lg text-xs gradient-neon text-primary-foreground font-medium">Marcar infinito</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSupport() {
  const [reqs, setReqs] = useState<any[]>([]);

  useEffect(() => {
    load();
    const ch = supabase.channel("support-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const load = async () => {
    const { data } = await supabase.from("support_requests").select("*").order("created_at", { ascending: false });
    setReqs(data || []);
  };

  const resolve = async (id: string) => {
    const { error } = await supabase.rpc("resolve_support_request", { _request_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Resolvido — usuário notificado");
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Solicitações</h1>
      <p className="text-muted-foreground mb-6">Erros e pedidos enviados pelos usuários.</p>
      <div className="space-y-3">
        {reqs.length === 0 && <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Nenhuma solicitação aberta.</div>}
        {reqs.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground">{r.account_name || "—"}</p>
                  <span className="text-xs text-muted-foreground">{r.user_email}</span>
                </div>
                <p className="text-sm text-foreground/90 break-words">{r.message}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <button onClick={() => resolve(r.id)} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow shrink-0">
                Marcar resolvido
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title || !message) { toast.error("Título e mensagem obrigatórios"); return; }
    setSending(true);
    const { data, error } = await supabase.rpc("broadcast_notification", { _title: title, _message: message, _plan: plan || undefined });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Enviada para ${data} usuário(s)!`);
    setTitle(""); setMessage("");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Enviar Notificação</h1>
      <div className="glass rounded-2xl p-6 max-w-2xl space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Mensagem</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Plano alvo (vazio = todos)</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm">
            <option value="">Todos os usuários</option>
            {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
        <button onClick={send} disabled={sending} className="gradient-neon px-6 py-3 rounded-xl text-sm font-semibold text-primary-foreground neon-glow w-full disabled:opacity-50">
          {sending ? "Enviando..." : "Enviar notificação"}
        </button>
      </div>
    </div>
  );
}

function AdminPlans() {
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("accounts").select("id, name, allowed_plans").order("name");
    setAccounts(data || []);
  };

  const toggle = async (id: string, current: string[], plan: string) => {
    const next = current.includes(plan) ? current.filter((p) => p !== plan) : [...current, plan];
    await supabase.from("accounts").update({ allowed_plans: next }).eq("id", id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Planos</h1>
      <p className="text-muted-foreground mb-6">Configure quais produtos cada plano pode acessar.</p>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Produto</th>
              {PLAN_OPTIONS.map((p) => <th key={p} className="px-4 py-3 text-muted-foreground font-medium uppercase text-xs">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-border/50">
                <td className="px-4 py-3 text-foreground font-medium">{a.name}</td>
                {PLAN_OPTIONS.map((p) => (
                  <td key={p} className="px-4 py-3 text-center">
                    <input type="checkbox" checked={(a.allowed_plans || []).includes(p)} onChange={() => toggle(a.id, a.allowed_plans || [], p)} className="w-4 h-4 accent-primary" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
  const updateStatus = async (id: string, status: string) => { await supabase.from("profiles").update({ status }).eq("id", id); toast.success("Status atualizado!"); load(); };
  const updatePlan = async (id: string, plan: string) => { await supabase.from("profiles").update({ plan }).eq("id", id); toast.success("Plano atualizado!"); load(); };

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
                  <select value={u.plan} onChange={(e) => updatePlan(u.id, e.target.value)} className="px-2 py-1 rounded-lg bg-input border border-border text-foreground text-xs uppercase">
                    {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${u.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => updateStatus(u.id, u.status === "active" ? "blocked" : "active")} className="px-3 py-1 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground">
                    {u.status === "active" ? "Bloquear" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminAffiliates() {
  const [links, setLinks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", commission: "", affiliate_url: "", image_url: "" });
  const [affiliateHtml, setAffiliateHtml] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);

  useEffect(() => { load(); loadHtml(); }, []);
  const load = async () => { const { data } = await supabase.from("affiliate_links").select("*").order("sort_order"); setLinks(data || []); };
  const loadHtml = async () => {
    const { data } = await supabase.from("site_settings").select("id, affiliate_html").limit(1).maybeSingle();
    if (data) { setSettingsId(data.id); setAffiliateHtml((data as any).affiliate_html || ""); }
  };
  const saveHtml = async () => {
    if (!settingsId) { toast.error("Configurações do site não encontradas"); return; }
    const { error } = await supabase.from("site_settings").update({ affiliate_html: affiliateHtml } as any).eq("id", settingsId);
    if (error) { toast.error(error.message); return; }
    toast.success("HTML de afiliados salvo!");
  };
  const save = async () => {
    if (!form.name || !form.affiliate_url) { toast.error("Nome e URL obrigatórios"); return; }
    await supabase.from("affiliate_links").insert(form);
    toast.success("Link adicionado!");
    setShowForm(false); setForm({ name: "", description: "", commission: "", affiliate_url: "", image_url: "" });
    load();
  };
  const remove = async (id: string) => { await supabase.from("affiliate_links").delete().eq("id", id); load(); };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Afiliados</h1>
          <button onClick={() => setShowForm(true)} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow">
            <Plus className="w-4 h-4" /> Novo Link
          </button>
        </div>
        {showForm && (
          <div className="glass rounded-2xl p-6 mb-6 space-y-3">
            {[{ k: "name", l: "Nome" }, { k: "commission", l: "Comissão" }, { k: "affiliate_url", l: "URL" }, { k: "image_url", l: "Imagem" }].map((f) => (
              <input key={f.k} placeholder={f.l} value={(form as any)[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
            ))}
            <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm h-16 resize-none" />
            <div className="flex gap-2">
              <button onClick={save} className="gradient-neon px-6 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow">Criar</button>
              <button onClick={() => setShowForm(false)} className="px-6 py-2 rounded-xl text-sm border border-border text-muted-foreground">Cancelar</button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {links.map((l) => (
            <div key={l.id} className="glass rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{l.name}</p>
                <p className="text-sm text-muted-foreground">{l.commission || "—"}</p>
              </div>
              <button onClick={() => remove(l.id)} className="p-2 rounded-lg hover:bg-accent"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4 max-w-4xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-foreground">HTML customizado da página /afiliados</h2>
            <p className="text-xs text-muted-foreground">Quando preenchido, substitui a página padrão de afiliados em tempo real.</p>
          </div>
          <button onClick={() => setVisualOpen(true)} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow">
            🎨 Abrir editor visual (drag & drop)
          </button>
        </div>
        <textarea value={affiliateHtml} onChange={(e) => setAffiliateHtml(e.target.value)} placeholder="<!DOCTYPE html>..." spellCheck={false} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-xs font-mono h-80 resize-y" />
        <div>
          <p className="text-xs text-muted-foreground mb-2">Preview ao vivo:</p>
          <div className="rounded-xl overflow-hidden border border-border bg-black">
            <iframe title="Preview Afiliados" srcDoc={affiliateHtml || "<html><body style='font-family:sans-serif;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0f19'>Cole o HTML acima para ver o preview</body></html>"} sandbox="allow-same-origin" className="w-full h-[500px] border-0 bg-white" />
          </div>
        </div>
        <button onClick={saveHtml} className="gradient-neon px-8 py-3 rounded-xl font-semibold text-primary-foreground neon-glow w-full">Salvar HTML de afiliados</button>

        <HtmlAiPanel
          label="IA — Editora da página de Afiliados"
          currentHtml={affiliateHtml}
          onResult={(html) => setAffiliateHtml(html)}
        />
      </div>

      {visualOpen && (
        <GrapesEditor
          title="Editor Visual — Página de Afiliados"
          initialHtml={affiliateHtml}
          onClose={() => setVisualOpen(false)}
          onSave={async (html) => {
            setAffiliateHtml(html);
            if (!settingsId) { toast.error("Configurações não encontradas"); return; }
            const { error } = await supabase.from("site_settings").update({ affiliate_html: html } as any).eq("id", settingsId);
            if (error) throw error;
          }}
        />
      )}
    </div>
  );
}

function AdminSettings() {
  const [settings, setSettings] = useState({ site_name: "", primary_color: "#00B4FF", secondary_color: "#7A00FF", background_color: "#0B0F19", support_whatsapp: "" });

  useEffect(() => { load(); }, []);
  const load = async () => {
    const { data } = await supabase.from("site_settings").select("*").limit(1).single();
    if (data) setSettings({
      site_name: data.site_name || "",
      primary_color: data.primary_color || "#00B4FF",
      secondary_color: data.secondary_color || "#7A00FF",
      background_color: data.background_color || "#0B0F19",
      support_whatsapp: (data as any).support_whatsapp || "",
    });
  };
  const save = async () => {
    const { data: existing } = await supabase.from("site_settings").select("id").limit(1).single();
    if (existing) {
      const { error } = await supabase.from("site_settings").update(settings).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Configurações salvas! A landing foi atualizada em tempo real.");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Personalização</h1>
      <div className="glass rounded-2xl p-6 space-y-6 max-w-4xl">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome do site</label>
          <input value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">WhatsApp do suporte (com DDI, ex: 5511999998888)</label>
          <input value={settings.support_whatsapp} onChange={(e) => setSettings({ ...settings, support_whatsapp: e.target.value })} placeholder="5511999998888" className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm font-mono" />
          <p className="text-xs text-muted-foreground mt-1">Aparece como botão "Suporte" no painel do cliente. Deixe vazio para ocultar.</p>
        </div>
        {[{ label: "Cor primária", key: "primary_color" }, { label: "Cor secundária", key: "secondary_color" }, { label: "Cor de fundo", key: "background_color" }].map((c) => (
          <div key={c.key} className="flex items-center gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{c.label}</label>
              <input value={(settings as any)[c.key]} onChange={(e) => setSettings({ ...settings, [c.key]: e.target.value })} className="w-40 px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm font-mono" />
            </div>
            <input type="color" value={(settings as any)[c.key]} onChange={(e) => setSettings({ ...settings, [c.key]: e.target.value })} className="w-10 h-10 rounded-xl border-0 cursor-pointer" />
          </div>
        ))}

        <button onClick={save} className="gradient-neon px-8 py-3 rounded-xl font-semibold text-primary-foreground neon-glow w-full">Salvar alterações</button>
      </div>
    </div>
  );
}

function AdminDanger() {
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState("");

  const deleteAll = async () => {
    if (confirm2 !== "DELETAR TUDO") { toast.error("Digite exatamente: DELETAR TUDO"); return; }
    const { error } = await supabase.rpc("admin_delete_all_accounts");
    if (error) { toast.error(error.message); return; }
    toast.success("Todos os produtos foram removidos");
    setConfirm1(false); setConfirm2("");
  };

  const clearStock = async () => {
    if (!confirm("Tem certeza? Isso removerá TODOS os links/contas de estoque (mantém os produtos).")) return;
    const { error } = await supabase.rpc("admin_clear_all_stock");
    if (error) { toast.error(error.message); return; }
    toast.success("Estoque limpo!");
  };

  const [bulkText, setBulkText] = useState("");
  const addToAll = async () => {
    if (!bulkText.trim()) return;
    const { data: accs } = await supabase.from("accounts").select("id, delivery_type");
    const items = bulkText.split(";").map((s) => s.trim()).filter(Boolean);
    const rows: { account_id: string; content: string }[] = [];
    (accs || []).filter((a: any) => a.delivery_type === "shared").forEach((a: any) => {
      items.forEach((c) => rows.push({ account_id: a.id, content: c }));
    });
    if (rows.length === 0) return;
    const { error } = await supabase.from("account_stock_items").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} item(ns) adicionados (apenas produtos compartilhados)`);
    setBulkText("");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">⚠️ Zona Perigosa</h1>

      <div className="space-y-4 max-w-3xl">
        <div className="glass rounded-2xl p-6 border border-yellow-500/30">
          <h2 className="text-lg font-bold text-foreground mb-2">Adicionar estoque a todos</h2>
          <p className="text-sm text-muted-foreground mb-3">Adiciona os mesmos itens a todos os produtos compartilhados (exceto individuais). Separe por <strong>;</strong></p>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="https://link1.com;https://link2.com" className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-xs font-mono h-20 resize-none" />
          <button onClick={addToAll} className="mt-3 px-5 py-2 rounded-xl text-sm font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">Adicionar a todos compartilhados</button>
        </div>

        <div className="glass rounded-2xl p-6 border border-orange-500/30">
          <h2 className="text-lg font-bold text-foreground mb-2">Limpar todos os estoques</h2>
          <p className="text-sm text-muted-foreground mb-3">Remove TODOS os links/contas de estoque. Os produtos permanecem.</p>
          <button onClick={clearStock} className="px-5 py-2 rounded-xl text-sm font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/40">Limpar estoques</button>
        </div>

        <div className="glass rounded-2xl p-6 border border-red-500/40">
          <h2 className="text-lg font-bold text-destructive mb-2">Deletar TODOS os produtos</h2>
          <p className="text-sm text-muted-foreground mb-3">Esta ação remove permanentemente todos os produtos e seus estoques.</p>
          {!confirm1 ? (
            <button onClick={() => setConfirm1(true)} className="px-5 py-2 rounded-xl text-sm font-semibold bg-destructive/20 text-destructive border border-destructive/40">Quero deletar tudo</button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive font-bold">⚠️ Confirmação final: digite <code className="bg-destructive/20 px-2 py-0.5 rounded">DELETAR TUDO</code></p>
              <input value={confirm2} onChange={(e) => setConfirm2(e.target.value)} placeholder="DELETAR TUDO" className="w-full px-4 py-2.5 rounded-xl bg-input border border-destructive/40 text-foreground text-sm" />
              <div className="flex gap-2">
                <button onClick={deleteAll} className="px-5 py-2 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground">Confirmar exclusão</button>
                <button onClick={() => { setConfirm1(false); setConfirm2(""); }} className="px-5 py-2 rounded-xl text-sm border border-border text-muted-foreground">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
