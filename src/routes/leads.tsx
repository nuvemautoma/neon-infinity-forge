import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Search, Star, Phone, Mail, Trash2, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
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
  const [newColName, setNewColName] = useState("");
  const [showAddCol, setShowAddCol] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const onDragEnd = async (e: DragEndEvent) => {
    const leadId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const targetCol = overId.startsWith("col:") ? overId.slice(4) : leads.find((l) => l.id === overId)?.column_id;
    if (!targetCol) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.column_id === targetCol) return;
    const newPos = (byColumn[targetCol]?.length || 0);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, column_id: targetCol, position: newPos } : l));
    const { error } = await supabase.from("leads").update({ column_id: targetCol, position: newPos }).eq("id", leadId);
    if (error) toast.error(error.message);
  };

  const addColumn = async () => {
    if (!newColName.trim() || !userId) return;
    const color = COLUMN_COLORS[columns.length % COLUMN_COLORS.length];
    await supabase.from("lead_columns").insert({ user_id: userId, name: newColName.trim(), color, position: columns.length });
    setNewColName("");
    setShowAddCol(false);
  };

  const renameColumn = async (id: string, name: string) => {
    if (!name.trim()) return;
    await supabase.from("lead_columns").update({ name: name.trim() }).eq("id", id);
  };

  const deleteColumn = async (id: string) => {
    if (columns.length <= 1) { toast.error("Mantenha ao menos uma coluna"); return; }
    if (!confirm("Excluir esta coluna? Os leads dela ficarão sem coluna.")) return;
    await supabase.from("lead_columns").delete().eq("id", id);
  };

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><InfinityLogo /></div>;
  }

  const total = leads.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="top-right" theme="dark" />
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
        <div className="container mx-auto px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone, email…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm" />
          </div>
          <div className="ml-auto flex gap-1">
            <button onClick={() => scrollBy(-1)} className="p-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground transition-colors" aria-label="Rolar esquerda">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => scrollBy(1)} className="p-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground transition-colors" aria-label="Rolar direita">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div ref={scrollRef} className="h-full overflow-x-auto overflow-y-hidden px-4 py-4 scroll-smooth snap-x snap-mandatory" style={{ scrollbarWidth: "thin" }}>
            <div className="flex gap-3 h-full items-start min-w-max pb-3">
              {columns.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  leads={byColumn[col.id] || []}
                  tagsById={Object.fromEntries(tags.map((t) => [t.id, t]))}
                  assignments={assignments}
                  onCardClick={(l) => { setActiveLead(l); setShowModal(true); }}
                  onRename={(name) => renameColumn(col.id, name)}
                  onDelete={() => deleteColumn(col.id)}
                />
              ))}
              <div className="w-[280px] shrink-0 snap-start">
                {showAddCol ? (
                  <div className="glass rounded-2xl p-3 border border-dashed border-primary/40">
                    <input autoFocus value={newColName} onChange={(e) => setNewColName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") { setShowAddCol(false); setNewColName(""); } }} placeholder="Nome da coluna" className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm mb-2" />
                    <div className="flex gap-2">
                      <button onClick={addColumn} className="flex-1 px-3 py-1.5 rounded-lg gradient-neon text-primary-foreground text-xs font-semibold">Criar</button>
                      <button onClick={() => { setShowAddCol(false); setNewColName(""); }} className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-semibold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddCol(true)} className="w-full glass rounded-2xl p-4 border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm font-semibold">
                    <Plus className="w-4 h-4" />Nova coluna
                  </button>
                )}
              </div>
            </div>
          </div>
        </DndContext>
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

function Column({ column, leads, tagsById, assignments, onCardClick, onRename, onDelete }: {
  column: LeadColumn;
  leads: Lead[];
  tagsById: Record<string, LeadTag>;
  assignments: Record<string, string[]>;
  onCardClick: (l: Lead) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}` });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  return (
    <div className="w-[280px] shrink-0 snap-start flex flex-col max-h-[calc(100vh-180px)]">
      <div
        ref={setNodeRef}
        className={`glass rounded-2xl border transition-all flex flex-col flex-1 min-h-[200px] ${isOver ? "border-primary ring-2 ring-primary/30 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.5)]" : "border-border"}`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color, boxShadow: `0 0 10px ${column.color}` }} />
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { setEditing(false); if (name !== column.name) onRename(name); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(column.name); setEditing(false); } }}
              className="flex-1 min-w-0 px-2 py-1 rounded bg-input border border-border text-foreground text-sm font-semibold"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left text-sm font-bold text-foreground hover:text-primary transition-colors truncate">{column.name}</button>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold tabular-nums">{leads.length}</span>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir coluna">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ scrollbarWidth: "thin" }}>
          {leads.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8 italic opacity-60">Solte leads aqui</div>
          ) : (
            leads.map((l) => (
              <LeadCard key={l.id} lead={l} tags={(assignments[l.id] || []).map((id) => tagsById[id]).filter(Boolean)} onClick={() => onCardClick(l)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, tags, onClick }: { lead: Lead; tags: LeadTag[]; onClick: () => void }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-2.5 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-[0_4px_20px_-5px_hsl(var(--primary)/0.3)] transition-all ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      <div className="flex gap-2">
        <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing shrink-0">
          {lead.photo_url ? (
            <img src={lead.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/15 grid place-items-center text-primary text-sm font-bold">{lead.name.charAt(0).toUpperCase()}</div>
          )}
        </div>
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{lead.name}</div>
          {lead.rating != null && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{lead.rating}
              {lead.reviews_count != null && <span className="opacity-70">({lead.reviews_count})</span>}
            </div>
          )}
        </button>
      </div>
      {(lead.phone || lead.email) && (
        <div className="mt-2 space-y-0.5 pl-11">
          {lead.phone && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate"><Phone className="w-2.5 h-2.5 shrink-0" />{lead.phone}</div>}
          {lead.email && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate"><Mail className="w-2.5 h-2.5 shrink-0" />{lead.email}</div>}
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pl-11">
          {tags.map((t) => (
            <span key={t.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
