import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir Senha — Infinity I.A" }] }),
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error("Erro ao redefinir senha"); } else { setDone(true); toast.success("Senha redefinida com sucesso!"); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-strong rounded-3xl p-8 w-full max-w-md neon-glow">
        <h1 className="text-2xl font-bold text-foreground text-center mb-6">Redefinir Senha</h1>
        {done ? (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Sua senha foi redefinida com sucesso!</p>
            <a href="/acess" className="gradient-neon px-6 py-3 rounded-xl font-semibold text-primary-foreground inline-block neon-glow">Fazer Login</a>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nova senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Mínimo 6 caracteres" required />
            </div>
            <button type="submit" disabled={loading} className="w-full gradient-neon py-3 rounded-xl font-semibold text-primary-foreground neon-glow disabled:opacity-50">
              {loading ? "Salvando..." : "Redefinir Senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
