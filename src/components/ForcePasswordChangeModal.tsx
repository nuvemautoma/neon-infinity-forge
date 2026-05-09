import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  userId: string;
  onChanged: () => void;
}

export function ForcePasswordChangeModal({ open, userId, onChanged }: Props) {
  const [step, setStep] = useState<"warn" | "form">("warn");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 4) { toast.error("Mínimo de 4 caracteres"); return; }
    if (password === "0000") { toast.error("Não pode ser 0000"); return; }
    if (password !== confirm) { toast.error("As senhas não conferem"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setLoading(false); toast.error(error.message); return; }
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", userId);
    setLoading(false);
    toast.success("Senha alterada com sucesso!");
    onChanged();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="glass-strong rounded-3xl p-6 w-full max-w-md neon-glow"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl gradient-neon flex items-center justify-center">
                {step === "warn" ? <ShieldAlert className="w-6 h-6 text-primary-foreground" /> : <KeyRound className="w-6 h-6 text-primary-foreground" />}
              </div>
              <div>
                <h2 className="font-bold text-foreground text-lg">{step === "warn" ? "Altere sua senha padrão" : "Nova senha"}</h2>
                <p className="text-xs text-muted-foreground">Por segurança da sua conta</p>
              </div>
            </div>

            {step === "warn" ? (
              <>
                <p className="text-sm text-muted-foreground mb-5">
                  Sua conta ainda usa a senha padrão <code className="bg-accent px-1.5 py-0.5 rounded text-foreground">0000</code>. Defina uma senha pessoal agora para proteger seu acesso.
                </p>
                <button
                  onClick={() => setStep("form")}
                  className="w-full gradient-neon py-3 rounded-xl font-semibold text-primary-foreground neon-glow"
                >
                  Alterar senha agora
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nova senha</label>
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground"
                    placeholder="Mínimo 4 caracteres" autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Confirmar nova senha</label>
                  <input
                    type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground"
                    placeholder="Repita a senha"
                  />
                </div>
                <button
                  onClick={submit} disabled={loading}
                  className="w-full gradient-neon py-3 rounded-xl font-semibold text-primary-foreground neon-glow disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
