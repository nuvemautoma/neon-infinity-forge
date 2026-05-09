import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, LogOut, User, LayoutGrid, Calendar as CalendarIcon, Wrench, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { AccountCard } from "@/components/AccountCard";
import { AccountDetailModal } from "@/components/AccountDetailModal";
import { NotificationBell } from "@/components/NotificationBell";
import { FloatingSupportButton } from "@/components/FloatingSupportButton";
import { ForcePasswordChangeModal } from "@/components/ForcePasswordChangeModal";
import { toast } from "sonner";
import { Toaster } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — Infinity I.A" }],
  }),
});

interface Account {
  id: string;
  name: string;
  category: string;
  email?: string;
  password?: string;
  image_url?: string;
  main_link?: string;
  extra_links?: { label: string; url: string }[];
  observations?: string;
  status: string;
  is_featured: boolean;
  is_hidden: boolean;
  delivery_type?: string;
  unlimited_stock?: boolean;
  allowed_plans?: string[];
  kind?: string;
}

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id?: string; email?: string; full_name?: string; plan?: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tools, setTools] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [clonerAllowed, setClonerAllowed] = useState(false);
  

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate({ to: "/acess" });
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("plan, full_name, email, must_change_password").eq("id", authUser.id).single();
      const userPlan = profile?.plan || "basic";
      setUser({ id: authUser.id, email: authUser.email, full_name: profile?.full_name ?? undefined, plan: userPlan });
      setMustChangePassword(!!(profile as any)?.must_change_password);

      const [{ data: settings }, { data: roles }] = await Promise.all([
        supabase.from("site_settings").select("cloner_allowed_plans").maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", authUser.id),
      ]);
      const isAdmin = (roles || []).some((r) => r.role === "admin");
      const planList = (settings as any)?.cloner_allowed_plans || ["standard"];
      setClonerAllowed(isAdmin || planList.includes(userPlan));

      loadAccounts(userPlan);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/acess" });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadAccounts = async (plan: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("status", "active")
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar contas");
    } else {
      const all = (data as unknown as Account[]) || [];
      const allowed = all.filter((a) => !a.allowed_plans || a.allowed_plans.length === 0 || a.allowed_plans.includes(plan));
      setAccounts(allowed.filter((a) => (a.kind ?? "account") === "account"));
      setTools(allowed.filter((a) => a.kind === "tool"));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/acess" });
  };

  const matches = (a: Account) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase());
  const filtered = accounts.filter(matches);
  const filteredTools = tools.filter(matches);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <header className="glass-strong border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <InfinityLogo size={36} />
            <span className="font-bold text-foreground hidden sm:block">INFINITY I.A</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/dashboard" className="text-sm font-medium text-primary">Dashboard</Link>
            <Link to="/agenda" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Agenda</Link>
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 glass rounded-xl px-3 py-2">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">{user?.email}</span>
              <span className="text-xs text-primary font-medium uppercase">{user?.plan}</span>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-accent transition-colors" title="Sair">
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>


      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold text-foreground">Bem-vindo(a) 👋</h1>
          <p className="text-muted-foreground mt-1">Aqui estão suas contas disponíveis.</p>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mt-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conta..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
        </motion.div>

        {/* Accounts Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-5 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-accent" />
                    <div className="flex-1">
                      <div className="h-4 bg-accent rounded w-3/4 mb-2" />
                      <div className="h-3 bg-accent rounded w-1/2" />
                    </div>
                  </div>
                  <div className="mt-4 h-3 bg-accent rounded w-1/3" />
                </div>
              ))
            : filtered.map((account, i) => (
                <AccountCard
                  key={account.id}
                  name={account.name}
                  category={account.category}
                  status={account.status}
                  imageUrl={account.image_url ?? undefined}
                  onClick={() => setSelectedAccount(account)}
                  index={i}
                />
              ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <LayoutGrid className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma conta encontrada.</p>
          </div>
        )}

        {/* Ferramentas Exclusivas */}
        {!loading && tools.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center gap-3 mb-2">
              <Wrench className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Ferramentas Exclusivas</h2>
            </div>
            <p className="text-muted-foreground mb-6 text-sm">Acessos premium liberados para o seu plano.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTools.map((account, i) => (
                <AccountCard
                  key={account.id}
                  name={account.name}
                  category={account.category}
                  status={account.status}
                  imageUrl={account.image_url ?? undefined}
                  onClick={() => setSelectedAccount(account)}
                  index={i}
                />
              ))}
            </div>
          </section>
        )}

        {/* CTA Agenda */}
        <Link
          to="/agenda"
          className="mt-14 block glass-strong border border-primary/30 rounded-2xl p-6 hover:border-primary transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl gradient-neon flex items-center justify-center neon-glow">
              <CalendarIcon className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">Sua Agenda Inteligente</h3>
              <p className="text-sm text-muted-foreground">Cadastre rotinas, ative notificações e receba um lembrete 30 minutos antes de cada compromisso.</p>
            </div>
          </div>
        </Link>
      </main>

      <AccountDetailModal
        account={selectedAccount}
        isOpen={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
      />

      {user?.id && (
        <ForcePasswordChangeModal
          open={mustChangePassword}
          userId={user.id}
          onChanged={() => setMustChangePassword(false)}
        />
      )}

      <FloatingSupportButton />
    </div>
  );
}
