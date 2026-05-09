import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Bell, BellOff, Clock, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { FloatingSupportButton } from "@/components/FloatingSupportButton";
import {
  registerServiceWorker,
  requestNotificationPermission,
  getNotificationPermission,
  showLocalNotification,
} from "@/lib/push";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda — Infinity I.A" },
      { name: "description", content: "Sua agenda inteligente com lembretes 30 minutos antes." },
    ],
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
  }),
});

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  time_of_day: string;
  days_of_week: number[];
  repeat_count: number;
  notify_enabled: boolean;
  is_active: boolean;
}

// Calcula o próximo "now" em SP
function nowSP(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function AgendaPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    time_of_day: "08:00",
    days_of_week: [1, 2, 3, 4, 5] as number[],
    repeat_count: 1,
    notify_enabled: true,
  });
  const sentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      setUserId(user.id);
      registerServiceWorker();
      setPerm(getNotificationPermission());
      await load(user.id);
    })();
  }, [navigate]);

  // Loop de checagem: a cada 30s, vê se algum evento começa em ~30min
  useEffect(() => {
    if (perm !== "granted" || events.length === 0) return;
    const tick = () => {
      const sp = nowSP();
      const target = new Date(sp.getTime() + 30 * 60 * 1000);
      const dow = target.getDay();
      const hh = String(target.getHours()).padStart(2, "0");
      const mm = String(target.getMinutes()).padStart(2, "0");
      const timeKey = `${hh}:${mm}`;
      const dayKey = `${target.getFullYear()}-${target.getMonth()}-${target.getDate()}`;

      events.forEach((ev) => {
        if (!ev.notify_enabled || !ev.is_active) return;
        if (!ev.days_of_week.includes(dow)) return;
        if (ev.time_of_day.slice(0, 5) !== timeKey) return;
        const k = `${ev.id}-${dayKey}-${timeKey}`;
        if (sentRef.current.has(k)) return;
        sentRef.current.add(k);
        try { localStorage.setItem(`agenda-sent:${k}`, "1"); } catch {}
        showLocalNotification(
          `⏰ Em 30 min: ${ev.title}`,
          ev.description || "Hora de se preparar!",
          "/agenda"
        );
      });
    };
    // hidrata sentRef do localStorage
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("agenda-sent:")) sentRef.current.add(k.replace("agenda-sent:", ""));
      });
    } catch {}
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, [perm, events]);

  const load = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase.from("agenda_events").select("*").eq("user_id", uid).order("time_of_day");
    setEvents((data as any) || []);
    setLoading(false);
  };

  const enableNotif = async () => {
    await registerServiceWorker();
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      toast.success("Notificações ativadas! Mantenha o app instalado/aberto para receber.");
      showLocalNotification("Notificações ativas ✅", "Você receberá um lembrete 30 min antes de cada compromisso.");
    } else {
      toast.error("Permissão negada. Ative nas configurações do navegador.");
    }
  };

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d].sort(),
    }));
  };

  const save = async () => {
    if (!form.title) { toast.error("Dê um título para a rotina"); return; }
    if (form.days_of_week.length === 0) { toast.error("Selecione ao menos um dia"); return; }
    if (!userId) return;
    const { error } = await supabase.from("agenda_events").insert({ ...form, user_id: userId });
    if (error) { toast.error(error.message); return; }
    toast.success("Rotina criada!");
    setShowForm(false);
    setForm({ title: "", description: "", time_of_day: "08:00", days_of_week: [1, 2, 3, 4, 5], repeat_count: 1, notify_enabled: true });
    load(userId);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta rotina?")) return;
    await supabase.from("agenda_events").delete().eq("id", id);
    if (userId) load(userId);
  };

  const toggleNotify = async (ev: AgendaEvent) => {
    await supabase.from("agenda_events").update({ notify_enabled: !ev.notify_enabled }).eq("id", ev.id);
    if (userId) load(userId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" theme="dark" />

      <header className="glass-strong border-b border-border sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            <InfinityLogo size={32} />
            <span className="font-bold text-foreground hidden sm:block">AGENDA</span>
          </Link>
          {perm !== "granted" ? (
            <button onClick={enableNotif} className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow flex items-center gap-2">
              <Bell className="w-4 h-4" /> Ativar Notificações
            </button>
          ) : (
            <span className="flex items-center gap-2 text-xs text-green-400 px-3 py-2 rounded-xl bg-green-500/15">
              <Bell className="w-4 h-4" /> Notificações ativas
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-primary" /> Sua Agenda
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre rotinas com horário e dias. Receba um aviso <strong className="text-primary">30 minutos antes</strong> de cada compromisso.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Para receber lembretes mesmo com a tela bloqueada, instale o app (menu do navegador → "Adicionar à tela inicial") e mantenha-o em segundo plano.
          </p>
        </motion.div>

        <button onClick={() => setShowForm((v) => !v)} className="mt-6 gradient-neon px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow">
          <Plus className="w-4 h-4" /> Nova Rotina
        </button>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-6 mt-4 space-y-4 border border-primary/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Título</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Muay Thai"
                  className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Horário</label>
                <input type="time" value={form.time_of_day} onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição (opcional)</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes do compromisso"
                className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm h-20 resize-none" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Dias da semana</label>
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((label, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.days_of_week.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Repetições no dia</label>
                <input type="number" min={1} max={20} value={form.repeat_count}
                  onChange={(e) => setForm({ ...form, repeat_count: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm" />
                <p className="text-xs text-muted-foreground mt-1">Quantas vezes esse compromisso se repete no mesmo dia.</p>
              </div>
              <label className="flex items-end gap-2 text-sm text-foreground pb-2">
                <input type="checkbox" checked={form.notify_enabled} onChange={(e) => setForm({ ...form, notify_enabled: e.target.checked })}
                  className="w-4 h-4 accent-primary" />
                Ativar notificação (30 min antes)
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={save} className="gradient-neon px-6 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow">Salvar Rotina</button>
              <button onClick={() => setShowForm(false)} className="px-6 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border">Cancelar</button>
            </div>
          </motion.div>
        )}

        <div className="mt-8 space-y-3">
          {loading && <p className="text-muted-foreground">Carregando...</p>}
          {!loading && events.length === 0 && (
            <div className="text-center py-12 glass rounded-2xl">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma rotina cadastrada ainda.</p>
            </div>
          )}
          {events.map((ev, i) => (
            <motion.div key={ev.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-strong rounded-2xl p-5 flex items-center gap-4 border border-border hover:border-primary/40 transition-colors">
              <div className="w-14 h-14 rounded-xl gradient-neon flex flex-col items-center justify-center text-primary-foreground neon-glow shrink-0">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold mt-0.5">{ev.time_of_day.slice(0, 5)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{ev.title}</h3>
                {ev.description && <p className="text-xs text-muted-foreground truncate">{ev.description}</p>}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {DAY_LABELS.map((d, idx) => (
                    <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded ${ev.days_of_week.includes(idx) ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"}`}>{d}</span>
                  ))}
                  {ev.repeat_count > 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/20 text-secondary-foreground">x{ev.repeat_count}/dia</span>}
                </div>
              </div>
              <button onClick={() => toggleNotify(ev)} className="p-2 rounded-lg hover:bg-accent transition-colors" title={ev.notify_enabled ? "Desativar avisos" : "Ativar avisos"}>
                {ev.notify_enabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
              </button>
              <button onClick={() => remove(ev.id)} className="p-2 rounded-lg hover:bg-accent transition-colors">
                <Trash2 className="w-5 h-5 text-destructive" />
              </button>
            </motion.div>
          ))}
        </div>
      </main>
      <FloatingSupportButton />
    </div>
  );
}
