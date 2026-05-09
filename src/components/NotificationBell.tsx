import { useEffect, useState, useRef } from "react";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      load(user.id);
      channel = supabase
        .channel("notif-" + user.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load(user.id))
        .subscribe();
    })();
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const load = async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notification[]) || []);
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (userId) load(userId);
  };

  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    if (userId) load(userId);
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    load(userId);
  };

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-xl hover:bg-accent transition-colors">
        <Bell className="w-5 h-5 text-foreground" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center neon-glow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] glass-strong rounded-2xl border border-border shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <p className="font-semibold text-foreground text-sm">Notificações</p>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Sem notificações</p>
              ) : (
                items.map((n) => (
                  <div key={n.id} className={`p-3 border-b border-border/50 hover:bg-accent/30 transition-colors ${!n.read ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {!n.read && (
                          <button onClick={() => markRead(n.id)} className="p-1 rounded hover:bg-accent transition-colors" title="Marcar como lida">
                            <Check className="w-3 h-3 text-primary" />
                          </button>
                        )}
                        <button onClick={() => remove(n.id)} className="p-1 rounded hover:bg-accent transition-colors" title="Remover">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
