import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, MapPin, Star, Phone, Mail, Globe, Trash2, Settings } from "lucide-react";
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

      // Realtime
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

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><InfinityLogo /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" theme="dark" />
      <FloatingSupportButton />
      <header className="border-b border-border glass sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5 text-foreground" /></Link>
          <h1 className="text-lg font-bold text-foreground flex-1">Leads</h1>
          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 pr-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm w-56" />
          </div>
          <Link to="/leads/extrair" className="px-4 py-2 rounded-xl gradient-neon text-primary-foreground text-sm font-semibold neon-glow flex items-center gap-2"><Search className="w-4 h-4" />Extrair</Link>
          <button onClick={() => { setActiveLead(null); setShowModal(true); }} className="px-4 py-2 rounded-xl bg-primary/15 text-primary text-sm font-semibold border border-primary/30 flex items-center gap-2"><Plus className="w-4 h-4" />Manual</button>
        </div>
      </header>

      <div className="p-4 overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max pb-4">
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
            <div className="w-72 shrink-0">
              <div className="glass rounded-2xl p-4 border border-dashed border-border">
                <input value={newColName} onChange={(e) => setNewColName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addColumn()} placeholder="Nova coluna..." className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm mb-2" />
                <button onClick={addColumn} className="w-full px-3 py-2 rounded-lg bg-primary/15 text-primary text-sm font-semibold border border-primary/30 flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Adicionar coluna</button>
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
    <div className="w-72 shrink-0">
      <div ref={setNodeRef} className={`glass rounded-2xl p-3 border transition-colors ${isOver ? "border-primary" : "border-border"} min-h-[200px]`}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { setEditing(false); if (name !== column.name) onRename(name); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(column.name); setEditing(false); } }}
              className="flex-1 px-2 py-1 rounded bg-input border border-border text-foreground text-sm font-semibold"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="flex-1 text-left text-sm font-bold text-foreground hover:text-primary transition-colors">{column.name}</button>
          )}
          <span className="text-xs text-muted-foreground">{leads.length}</span>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-2">
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} tags={(assignments[l.id] || []).map((id) => tagsById[id]).filter(Boolean)} onClick={() => onCardClick(l)} />
          ))}
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
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`p-3 rounded-xl bg-card border border-border hover:border-primary/50 cursor-pointer transition-all ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex gap-2">
        {lead.photo_url ? (
          <img src={lead.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/15 grid place-items-center text-primary text-sm font-bold shrink-0">{lead.name.charAt(0).toUpperCase()}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{lead.name}</div>
          {lead.rating != null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{lead.rating}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {lead.phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate"><Phone className="w-3 h-3" />{lead.phone}</div>}
        {lead.email && <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate"><Mail className="w-3 h-3" />{lead.email}</div>}
      </div>
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
