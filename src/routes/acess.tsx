import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { resetPasswordWithPurchase } from "@/lib/password-reset.functions";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/acess")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Login — Infinity I.A" },
      { name: "description", content: "Acesse sua conta Infinity I.A" },
    ],
  }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const resetFn = useServerFn(resetPasswordWithPurchase);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("invalid")) toast.error("Email ou senha incorretos");
      else if (msg.includes("confirm")) toast.error("Confirme seu email antes de entrar");
      else toast.error(error.message || "Não foi possível entrar");
    } else if (data.session) {
      // aguarda persistir a sessão antes de redirecionar
      await supabase.auth.getSession();
      window.location.href = "/dashboard";
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !purchaseDate || !newPassword) { toast.error("Preencha todos os campos"); return; }
    setLoading(true);
    try {
      await resetFn({ data: { email, purchaseDate, newPassword } });
      toast.success("Senha alterada! Faça login com a nova senha.");
      setIsReset(false);
      setPassword(""); setNewPassword(""); setPurchaseDate("");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível alterar a senha");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Aurora background */}
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      {/* Animated grid */}
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      {/* Floating gradient blobs */}
      <div
        aria-hidden
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-40 animate-blob pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 250 / 70%), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -right-32 w-[600px] h-[600px] rounded-full blur-3xl opacity-35 animate-blob pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.22 300 / 60%), transparent 70%)", animationDelay: "-6s" }}
      />
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-3xl opacity-25 animate-blob pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.70 0.20 200 / 60%), transparent 70%)", animationDelay: "-12s" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10 neon-glow-strong border-glow"
      >
        {/* Conic glow border accent */}
        <div aria-hidden className="absolute -inset-px rounded-3xl conic-glow opacity-20 pointer-events-none animate-spin-slow" />

        <div className="relative text-center mb-8">
          <div className="flex justify-center mb-4">
            <InfinityLogo size={84} />
          </div>
          <h1 className="text-3xl font-bold gradient-neon-text">INFINITY I.A</h1>
          <p className="text-xs text-primary mt-2 tracking-[0.3em] uppercase opacity-80">Entrega de Contas Plus</p>
        </div>

        {isReset ? (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-4">Informe o email da compra e a data exata da compra para definir uma nova senha.</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email da compra</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground"
                placeholder="seu@email.com" required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data da compra</label>
              <input
                type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nova senha</label>
              <input
                type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground"
                placeholder="Mínimo 4 caracteres" minLength={4} required
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full gradient-neon py-3 rounded-xl font-semibold text-primary-foreground neon-glow disabled:opacity-50"
            >
              {loading ? "Validando..." : "Alterar senha"}
            </button>
            <button type="button" onClick={() => setIsReset(false)} className="w-full text-sm text-muted-foreground hover:text-primary">
              Voltar ao login
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-4">Entre com seu email e senha para continuar</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                <input type="checkbox" className="rounded border-border" />
                Lembrar de mim
              </label>
              <button type="button" onClick={() => setIsReset(true)} className="text-primary hover:underline">
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-neon py-3 rounded-xl font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 neon-glow"
            >
              {loading ? "Entrando..." : <><LogIn className="w-4 h-4" /> Entrar</>}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Não tem uma conta? <a href="/" className="text-primary hover:underline">Fale com o suporte</a>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
