import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, Star, Phone, Mail, Trash2, Users, MoreVertical, Pencil, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { FloatingSupportButton } from "@/components/FloatingSupportButton";
import { LeadDetailModal } from "@/components/Leads/LeadDetailModal";
import type { Lead, LeadColumn, LeadTag } from "@/components/Leads/types";
import { COLUMN_COLORS } from "@/components/Leads/types";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/leads")({
  component: LeadsPage,
  head: () => ({ meta: [{ title: "Leads — Infinity I.A" }] }),
});

const DEFAULT_COLUMNS = [
  { name: "Novo", color: "#00B4FF" },
  { name: "Em contato", color: "#7A00FF" },
  { name: "Negociando", color: "#FFD60A" },
  { name: "Fechado", color: "#34D399" },
  { name: "Perdido", color: "#F87171" },
];

function LeadsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [columns, setColumns] = useState<LeadColumn[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState("");

  const reload = async (uid: string) => {
    const [{ data: cols }, { data: lds }, { data: tgs }, { data: ass }] = await Promise.all([
      supabase.from("lead_columns").select("*").eq("user_id", uid).order("position"),
      supabase.from("leads").select("*").eq("user_id", uid).order("position"),
      supabase.from("lead_tags").select("*").eq("user_id", uid).order("name"),
      supabase.from("lead_tag_assignments").select("lead_id, tag_id"),
    ]);
    let cs = (cols || []) as LeadColumn[];
    if (!cs.length) {
      const inserted = await supabase.from("lead_columns").insert(
        DEFAULT_COLUMNS.map((c, i) => ({ user_id: uid, name: c.name, color: c.color, position: i }))
      ).select("*");
      cs = (inserted.data || []) as LeadColumn[];
    }
    setColumns(cs);
    setLeads((lds || []) as Lead[]);
    setTags((tgs || []) as LeadTag[]);
    const map: Record<string, string[]> = {};
    for (const a of (ass || []) as Array<{ lead_id: string; tag_id: string }>) {
      (map[a.lead_id] ||= []).push(a.tag_id);
    }
    setAssignments(map);
    setActiveColId((prev) => prev && cs.find((c) => c.id === prev) ? prev : cs[0]?.id || null);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      setUserId(user.id);
      await reload(user.id);

      const ch = supabase
        .channel(`leads-${user.id}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `user_id=eq.${user.id}` }, () => reload(user.id))
        .on("postgres_changes", { event: "*", schema: "public", table: "lead_columns", filter: `user_id=eq.${user.id}` }, () => reload(user.id))
        .on("postgres_changes", { event: "*", schema: "public", table: "lead_tag_assignments" }, () => reload(user.id))
        .on("postgres_changes", { event: "*", schema: "public", table: "lead_tags", filter: `user_id=eq.${user.id}` }, () => reload(user.id))
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
  }, [navigate]);

  const filtered = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) => l.name.toLowerCase().includes(q) || (l.phone || "").includes(q) || (l.email || "").toLowerCase().includes(q) || (l.address || "").toLowerCase().includes(q));
  }, [leads, search]);

  const byColumn = useMemo(() => {
    const m: Record<string, Lead[]> = {};
    for (const c of columns) m[c.id] = [];
    for (const l of filtered) {
      const cid = l.column_id || columns[0]?.id;
      if (cid && m[cid]) m[cid].push(l);
    }
    for (const cid in m) m[cid].sort((a, b) => a.position - b.position);
    return m;
  }, [filtered, columns]);

  const moveLead = async (leadId: string, targetCol: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.column_id === targetCol) return;
    const newPos = byColumn[targetCol]?.length || 0;
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, column_id: targetCol, position: newPos } : l));
    const { error } = await supabase.from("leads").update({ column_id: targetCol, position: newPos }).eq("id", leadId);
    if (error) toast.error(error.message);
    else toast.success("Lead movido");
  };

  const addColumn = async () => {
    if (!newColName.trim() || !userId) return;
    const color = COLUMN_COLORS[columns.length % COLUMN_COLORS.length];
    const { data, error } = await supabase.from("lead_columns").insert({ user_id: userId, name: newColName.trim(), color, position: columns.length }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setNewColName(""); setShowAddCol(false);
    if (data?.id) setActiveColId(data.id);
  };

  const renameColumn = async (id: string) => {
    if (!editingColName.trim()) { setEditingColId(null); return; }
    await supabase.from("lead_columns").update({ name: editingColName.trim() }).eq("id", id);
    setEditingColId(null);
  };

  const deleteColumn = async (id: string) => {
    if (columns.length <= 1) { toast.error("Mantenha ao menos uma coluna"); return; }
    if (!confirm("Excluir esta coluna? Os leads dela ficarão sem coluna.")) return;
    await supabase.from("lead_columns").delete().eq("id", id);
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><InfinityLogo /></div>;
  }

  const total = leads.length;
  const activeCol = columns.find((c) => c.id === activeColId) || columns[0];
  const activeLeads = activeCol ? (byColumn[activeCol.id] || []) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="top-right" theme="dark" richColors />
      <FloatingSupportButton />

      <header className="border-b border-border glass sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Users className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-lg font-bold text-foreground truncate">Meus Leads</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {total} no total</span>
          </div>
          <Link to="/leads/extrair" className="px-4 py-2 rounded-xl gradient-neon text-primary-foreground text-sm font-semibold neon-glow flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Extrair leads</span>
          </Link>
          <button onClick={() => { setActiveLead(null); setShowModal(true); }} className="px-4 py-2 rounded-xl bg-primary/15 text-primary text-sm font-semibold border border-primary/30 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>
        <div className="container mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone, email…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
          </div>
        </div>
      </header>

      {/* Tabs de colunas — quebram em linhas, sem rolagem horizontal */}
      <div className="border-b border-border bg-background/60">
        <div className="container mx-auto px-2 flex flex-wrap gap-1">
          {columns.map((col) => {
            const count = (byColumn[col.id] || []).length;
            const isActive = col.id === activeCol?.id;
            return (
              <button
                key={col.id}
                onClick={() => setActiveColId(col.id)}
                className={`relative px-4 py-3 text-sm font-semibold whitespace-nowrap flex items-center gap-2 transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color, boxShadow: isActive ? `0 0 8px ${col.color}` : "none" }} />
                {col.name}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full tabular-nums ${isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{count}</span>
                {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" style={{ boxShadow: `0 0 8px ${col.color}` }} />}
              </button>
            );
          })}
          {showAddCol ? (
            <div className="flex items-center gap-1 px-2">
              <input autoFocus value={newColName} onChange={(e) => setNewColName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") { setShowAddCol(false); setNewColName(""); } }} placeholder="Nome" className="px-3 py-1.5 rounded-lg bg-input border border-border text-foreground text-sm w-32" />
              <button onClick={addColumn} className="px-2 py-1.5 rounded-lg gradient-neon text-primary-foreground text-xs font-bold">OK</button>
              <button onClick={() => { setShowAddCol(false); setNewColName(""); }} className="px-2 py-1.5 rounded-lg bg-muted text-foreground text-xs">×</button>
            </div>
          ) : (
            <button onClick={() => setShowAddCol(true)} className="px-3 py-3 text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 whitespace-nowrap">
              <Plus className="w-4 h-4" />Nova
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo da coluna ativa */}
      <div className="flex-1 container mx-auto px-4 py-4">
        {activeCol && (
          <div className="mb-3 flex items-center gap-2">
            {editingColId === activeCol.id ? (
              <>
                <input autoFocus value={editingColName} onChange={(e) => setEditingColName(e.target.value)} onBlur={() => renameColumn(activeCol.id)} onKeyDown={(e) => { if (e.key === "Enter") renameColumn(activeCol.id); if (e.key === "Escape") setEditingColId(null); }} className="px-3 py-1.5 rounded-lg bg-input border border-primary text-foreground text-sm font-bold" />
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeCol.color, boxShadow: `0 0 12px ${activeCol.color}` }} />
                  {activeCol.name}
                </h2>
                <button onClick={() => { setEditingColId(activeCol.id); setEditingColName(activeCol.name); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Renomear">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteColumn(activeCol.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive ml-auto" aria-label="Excluir coluna">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        {activeLeads.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhum lead nesta coluna ainda.</p>
            <Link to="/leads/extrair" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-primary/15 text-primary text-sm font-semibold border border-primary/30">
              <Search className="w-4 h-4" />Extrair leads
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeLeads.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                tags={(assignments[l.id] || []).map((id) => tags.find((t) => t.id === id)).filter(Boolean) as LeadTag[]}
                columns={columns}
                onClick={() => { setActiveLead(l); setShowModal(true); }}
                onMove={(colId) => moveLead(l.id, colId)}
              />
            ))}
          </div>
        )}
      </div>

      {userId && (
        <LeadDetailModal
          lead={activeLead}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          columns={columns}
          tags={tags}
          assignedTagIds={activeLead ? (assignments[activeLead.id] || []) : []}
          userId={userId}
          onSaved={() => userId && reload(userId)}
        />
      )}
    </div>
  );
}

function LeadCard({ lead, tags, columns, onClick, onMove }: {
  lead: Lead; tags: LeadTag[]; columns: LeadColumn[];
  onClick: () => void; onMove: (colId: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="relative p-3 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-[0_4px_20px_-5px_hsl(var(--primary)/0.3)] transition-all">
      <div className="flex gap-2.5">
        {lead.photo_url ? (
          <img src={lead.photo_url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-primary/15 grid place-items-center text-primary text-base font-bold shrink-0">{lead.name.charAt(0).toUpperCase()}</div>
        )}
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">{lead.name}</div>
          {lead.rating != null && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{lead.rating}
              {lead.reviews_count != null && <span className="opacity-70">({lead.reviews_count})</span>}
            </div>
          )}
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} onBlur={() => setTimeout(() => setMenu(false), 150)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Mover">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-full mt-1 w-44 z-30 rounded-xl glass-strong border border-border shadow-2xl overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border/50">Mover para</div>
              {columns.filter((c) => c.id !== lead.column_id).map((c) => (
                <button key={c.id} onMouseDown={() => onMove(c.id)} className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-2 transition-colors">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <ArrowRight className="w-3 h-3 opacity-50" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {(lead.phone || lead.email) && (
        <div className="mt-2 space-y-0.5">
          {lead.phone && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate"><Phone className="w-3 h-3 shrink-0" />{lead.phone}</div>}
          {lead.email && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate"><Mail className="w-3 h-3 shrink-0" />{lead.email}</div>}
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((t) => (
            <span key={t.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
