import { useEffect, useState } from "react";
import { Plus, Trash2, ExternalLink, Check, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Supplier = {
  id: string;
  account_id: string;
  supplier_name: string;
  supplier_url: string | null;
  unit_cost: number;
  quantity: number;
  notes: string | null;
};

type Account = { id: string; name: string };

type IssueReport = {
  id: string;
  user_id: string;
  user_email: string | null;
  account_id: string;
  account_name: string | null;
  stock_item_id: string | null;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

export function AdminOrganization() {
  const [subTab, setSubTab] = useState<"suppliers" | "issues">("suppliers");

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-4">Organização</h2>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSubTab("suppliers")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${subTab === "suppliers" ? "gradient-neon text-primary-foreground neon-glow" : "bg-accent text-muted-foreground hover:text-foreground"}`}
        >
          Fornecedores & Custos
        </button>
        <button
          onClick={() => setSubTab("issues")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${subTab === "issues" ? "gradient-neon text-primary-foreground neon-glow" : "bg-accent text-muted-foreground hover:text-foreground"}`}
        >
          Solicitações de Acesso
        </button>
      </div>

      {subTab === "suppliers" ? <SuppliersPanel /> : <IssuesPanel />}
    </div>
  );
}

function SuppliersPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ account_id: "", supplier_name: "", supplier_url: "", unit_cost: "0", quantity: "1", notes: "" });

  const load = async () => {
    setLoading(true);
    const [a, s] = await Promise.all([
      supabase.from("accounts").select("id, name").order("name"),
      supabase.from("account_suppliers").select("*").order("created_at", { ascending: false }),
    ]);
    setAccounts((a.data as Account[]) ?? []);
    setSuppliers((s.data as Supplier[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.account_id || !form.supplier_name.trim()) { toast.error("Produto e fornecedor obrigatórios"); return; }
    const { error } = await supabase.from("account_suppliers").insert({
      account_id: form.account_id,
      supplier_name: form.supplier_name.trim(),
      supplier_url: form.supplier_url.trim() || null,
      unit_cost: Number(form.unit_cost) || 0,
      quantity: Number(form.quantity) || 1,
      notes: form.notes.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Fornecedor adicionado");
    setForm({ account_id: "", supplier_name: "", supplier_url: "", unit_cost: "0", quantity: "1", notes: "" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Excluir fornecedor?")) return;
    const { error } = await supabase.from("account_suppliers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const totalGasto = suppliers.reduce((sum, s) => sum + s.unit_cost * s.quantity, 0);
  const accName = (id: string) => accounts.find(a => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="glass-strong rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Novo fornecedor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm">
            <option value="">Selecione um produto…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input placeholder="Nome do fornecedor" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className="px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
          <input placeholder="Link do fornecedor (URL)" value={form.supplier_url} onChange={e => setForm({ ...form, supplier_url: e.target.value })} className="px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
          <input type="number" step="0.01" placeholder="Valor unidade (R$)" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} className="px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
          <input type="number" placeholder="Quantidade" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
          <input placeholder="Observação" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
        </div>
        <button onClick={add} className="mt-3 gradient-neon px-5 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow">Adicionar</button>
      </div>

      <div className="glass-strong rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Fornecedores cadastrados</h3>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total gasto</p>
            <p className="text-2xl font-bold text-primary">R$ {totalGasto.toFixed(2)}</p>
          </div>
        </div>
        {loading ? <p className="text-muted-foreground text-sm">Carregando…</p> : suppliers.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum fornecedor cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground text-xs">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Produto</th>
                  <th className="py-2 pr-3">Fornecedor</th>
                  <th className="py-2 pr-3">Link</th>
                  <th className="py-2 pr-3">Unid.</th>
                  <th className="py-2 pr-3">Qtd</th>
                  <th className="py-2 pr-3">Subtotal</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-foreground">{accName(s.account_id)}</td>
                    <td className="py-2 pr-3 text-foreground">{s.supplier_name}</td>
                    <td className="py-2 pr-3">
                      {s.supplier_url ? <a href={s.supplier_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />abrir</a> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-foreground">R$ {s.unit_cost.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-foreground">{s.quantity}</td>
                    <td className="py-2 pr-3 text-primary font-semibold">R$ {(s.unit_cost * s.quantity).toFixed(2)}</td>
                    <td className="py-2"><button onClick={() => del(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function IssuesPanel() {
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignContent, setAssignContent] = useState("");
  const [assignLabel, setAssignLabel] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("account_issue_reports").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data } = await q;
    setIssues((data as IssueReport[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const resolve = async (id: string) => {
    const { error } = await supabase.rpc("admin_resolve_issue_report", { _report_id: id, _notes: null });
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação resolvida");
    load();
  };

  const assign = async (issue: IssueReport) => {
    if (!assignContent.trim()) { toast.error("Preencha o conteúdo do acesso"); return; }
    const { error } = await supabase.rpc("admin_assign_stock_to_user", {
      _account_id: issue.account_id,
      _user_id: issue.user_id,
      _content: assignContent.trim(),
      _label: assignLabel.trim() || undefined,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("admin_resolve_issue_report", { _report_id: issue.id, _notes: "Acesso entregue manualmente" });
    toast.success("Acesso entregue ao usuário");
    setAssigning(null); setAssignContent(""); setAssignLabel("");
    load();
  };

  const reasonLabel = (r: string) => ({
    login_invalido: "Login inválido",
    sem_creditos: "Créditos esgotados",
    sem_estoque: "Sem estoque",
    outro: "Outro",
    auto_rotated: "Rotacionado automaticamente",
  } as Record<string, string>)[r] ?? r;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setFilter("pending")} className={`px-3 py-1.5 rounded-lg text-xs ${filter === "pending" ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>Pendentes</button>
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>Todas</button>
      </div>

      {loading ? <p className="text-muted-foreground text-sm">Carregando…</p> : issues.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sem solicitações.</p>
      ) : (
        <div className="space-y-3">
          {issues.map(i => (
            <div key={i.id} className="glass-strong rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{i.account_name ?? i.account_id}</p>
                  <p className="text-xs text-muted-foreground">{i.user_email ?? i.user_id}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-300 text-xs">{reasonLabel(i.reason)}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs ${i.status === "pending" ? "bg-orange-500/10 text-orange-300" : "bg-green-500/10 text-green-300"}`}>{i.status}</span>
                    <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {i.admin_notes && <p className="text-xs text-muted-foreground mt-2">📝 {i.admin_notes}</p>}
                </div>
                {i.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setAssigning(assigning === i.id ? null : i.id)} className="p-2 rounded-lg bg-accent hover:bg-primary hover:text-primary-foreground transition" title="Anexar acesso manual"><UserPlus className="w-4 h-4" /></button>
                    <button onClick={() => resolve(i.id)} className="p-2 rounded-lg bg-accent hover:bg-green-500 hover:text-white transition" title="Marcar como resolvida"><Check className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              {assigning === i.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <input placeholder="Conteúdo do acesso (link, login:senha, etc.)" value={assignContent} onChange={e => setAssignContent(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
                  <input placeholder="Rótulo opcional (ex: Conta 3)" value={assignLabel} onChange={e => setAssignLabel(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAssigning(null); setAssignContent(""); setAssignLabel(""); }} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"><X className="w-3 h-3 inline" /> Cancelar</button>
                    <button onClick={() => assign(i)} className="gradient-neon px-4 py-1.5 rounded-lg text-xs font-semibold text-primary-foreground">Entregar acesso</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
