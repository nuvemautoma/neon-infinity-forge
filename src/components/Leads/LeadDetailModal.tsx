import { useEffect, useState } from "react";
import { X, Trash2, Plus, Star, Phone, Mail, Globe, MapPin, Tag as TagIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead, LeadColumn, LeadTag } from "./types";
import { TAG_COLORS } from "./types";

interface Props {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  columns: LeadColumn[];
  tags: LeadTag[];
  assignedTagIds: string[];
  userId: string;
  onSaved: () => void;
}

export function LeadDetailModal({ lead, isOpen, onClose, columns, tags, assignedTagIds, userId, onSaved }: Props) {
  const isNew = !lead;
  const [form, setForm] = useState<Partial<Lead>>({});
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(lead ? { ...lead } : {
      name: "", phone: "", email: "", website: "", address: "",
      description: "", category: "", notes: "", source: "manual",
      column_id: columns[0]?.id || null,
    });
    setTagSel(new Set(assignedTagIds));
  }, [isOpen, lead, columns, assignedTagIds]);

  if (!isOpen) return null;

  const save = async () => {
    if (!form.name || !form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      let leadId = lead?.id;
      if (isNew) {
        // posiciona no fim da coluna
        const colId = form.column_id || columns[0]?.id;
        const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("column_id", colId!);
        const { data, error } = await supabase.from("leads").insert({
          user_id: userId,
          name: form.name!,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          address: form.address || null,
          description: form.description || null,
          category: form.category || null,
          notes: form.notes || null,
          source: "manual",
          column_id: colId,
          position: count || 0,
        }).select("id").single();
        if (error) throw error;
        leadId = data.id;
      } else {
        const { error } = await supabase.from("leads").update({
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          address: form.address || null,
          description: form.description || null,
          category: form.category || null,
          notes: form.notes || null,
          column_id: form.column_id || null,
        }).eq("id", lead!.id);
        if (error) throw error;
      }

      // Sincroniza tags
      if (leadId) {
        const current = new Set(assignedTagIds);
        const toAdd = Array.from(tagSel).filter((t) => !current.has(t));
        const toRemove = Array.from(current).filter((t) => !tagSel.has(t));
        if (toAdd.length) {
          await supabase.from("lead_tag_assignments").insert(toAdd.map((tag_id) => ({ lead_id: leadId!, tag_id })));
        }
        if (toRemove.length) {
          await supabase.from("lead_tag_assignments").delete().eq("lead_id", leadId).in("tag_id", toRemove);
        }
      }

      toast.success(isNew ? "Lead criado" : "Lead atualizado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!lead || !confirm("Excluir este lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead excluído");
    onSaved();
    onClose();
  };

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const { data, error } = await supabase.from("lead_tags").insert({ user_id: userId, name, color: newTagColor }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setTagSel(new Set([...tagSel, data.id]));
    setNewTagName("");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="glass-strong rounded-2xl border border-border w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{isNew ? "Novo lead" : "Editar lead"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {lead?.photo_url && (
            <img src={lead.photo_url} alt="" className="w-full h-40 object-cover rounded-xl" />
          )}

          {lead?.rating != null && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-foreground font-semibold">{lead.rating}</span>
              {lead.reviews_count != null && <span className="text-muted-foreground">({lead.reviews_count} avaliações)</span>}
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
            <input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1.5"><Phone className="w-3 h-3" />Telefone</label>
              <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1.5"><Mail className="w-3 h-3" />Email</label>
              <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1.5"><Globe className="w-3 h-3" />Site</label>
              <input value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
              <input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1.5"><MapPin className="w-3 h-3" />Endereço</label>
            <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
            <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Anotações</label>
            <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Histórico de contato, observações..." className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Coluna</label>
            <select value={form.column_id || ""} onChange={(e) => setForm({ ...form, column_id: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm">
              {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1.5"><TagIcon className="w-3 h-3" />Etiquetas</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((t) => {
                const sel = tagSel.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const ns = new Set(tagSel);
                      if (sel) ns.delete(t.id); else ns.add(t.id);
                      setTagSel(ns);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${sel ? "text-white" : "text-muted-foreground bg-transparent"}`}
                    style={sel ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: t.color + "55" }}
                  >
                    {t.name}
                  </button>
                );
              })}
              {!tags.length && <span className="text-xs text-muted-foreground">Nenhuma etiqueta criada ainda.</span>}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nova etiqueta..." className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-input border border-border text-foreground text-xs" />
              <div className="flex gap-1">
                {TAG_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewTagColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${newTagColor === c ? "scale-110 border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <button type="button" onClick={createTag} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1"><Plus className="w-3 h-3" />Criar</button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-border">
          {!isNew ? (
            <button onClick={remove} className="px-4 py-2 rounded-xl text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors flex items-center gap-2"><Trash2 className="w-4 h-4" />Excluir</button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors">Cancelar</button>
            <button disabled={saving} onClick={save} className="px-6 py-2 rounded-xl gradient-neon text-primary-foreground text-sm font-semibold neon-glow disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
