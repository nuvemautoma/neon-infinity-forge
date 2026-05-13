import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ExternalLink, Eye, EyeOff, AlertTriangle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AccountDetail {
  id: string;
  name: string;
  category: string;
  email?: string;
  password?: string;
  main_link?: string;
  extra_links?: { label: string; url: string }[];
  observations?: string;
  image_url?: string;
  status: string;
  delivery_type?: string;
  unlimited_stock?: boolean;
}

interface AccountDetailModalProps {
  account: AccountDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AccountDetailModal({ account, isOpen, onClose }: AccountDetailModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [delivered, setDelivered] = useState<string | null>(null);
  const [deliveredItemId, setDeliveredItemId] = useState<string | null>(null);
  const [deliveredLabel, setDeliveredLabel] = useState<string | null>(null);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [reportReason, setReportReason] = useState<"login_invalido" | "sem_creditos" | "outro">("login_invalido");
  const [reporting, setReporting] = useState(false);

  const isIndividual = account?.delivery_type === "individual";
  const isShared = account?.delivery_type === "shared";

  useEffect(() => {
    setShowSupport(false);
    setSupportMsg("");
    setDelivered(null);
    setDeliveredItemId(null);
    setDeliveredLabel(null);
    if (!account || !isOpen) return;
    if (isIndividual) {
      claimItem();
    } else if (isShared) {
      claimShared();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, isOpen]);

  const claimItem = async () => {
    if (!account) return;
    setLoadingDelivery(true);
    const { data, error } = await supabase.rpc("claim_stock_item", { _account_id: account.id });
    setLoadingDelivery(false);
    if (error) { toast.error("Não foi possível obter o acesso: " + error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setDelivered(row?.content ?? null);
  };

  const claimShared = async () => {
    if (!account) return;
    setLoadingDelivery(true);
    const { data, error } = await supabase.rpc("claim_shared_account", { _account_id: account.id });
    setLoadingDelivery(false);
    if (error) {
      // sem itens cadastrados: cai no fallback de credenciais estáticas
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.content) {
      setDelivered(row.content);
      setDeliveredItemId(row.item_id ?? null);
      setDeliveredLabel(row.label ?? null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const reportIssue = async () => {
    if (!deliveredItemId) { toast.error("Sem acesso ativo para reportar"); return; }
    setReporting(true);
    const { data, error } = await supabase.rpc("report_account_issue", { _stock_item_id: deliveredItemId, _reason: reportReason });
    setReporting(false);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.escalated) {
      toast.success("Solicitação enviada ao admin. Você será notificado.");
      setDelivered(null); setDeliveredItemId(null); setDeliveredLabel(null);
    } else if (row?.new_content) {
      toast.success("Novo acesso entregue automaticamente!");
      setDelivered(row.new_content);
      setDeliveredItemId(row.new_item_id ?? null);
      setDeliveredLabel(row.new_label ?? null);
    }
  };

  const submitSupport = async () => {
    if (!account) return;
    if (!supportMsg.trim()) { toast.error("Descreva o problema"); return; }
    if (supportMsg.length > 900) { toast.error("Máx. 900 caracteres"); return; }
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }
    const { error } = await supabase.from("support_requests").insert({
      user_id: user.id,
      user_email: user.email,
      account_id: account.id,
      account_name: account.name,
      message: supportMsg.trim(),
    });
    setSending(false);
    if (error) { toast.error("Erro ao enviar"); return; }
    toast.success("Solicitação enviada! Você será notificado quando for resolvida.");
    setSupportMsg("");
    setShowSupport(false);
  };

  if (!account) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl p-8 w-full max-w-lg relative z-10 neon-glow max-h-[90vh] overflow-y-auto"
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl gradient-neon flex items-center justify-center overflow-hidden">
                {account.image_url ? (
                  <img src={account.image_url} alt={account.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-primary-foreground">{account.name[0]}</span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{account.name}</h2>
                <p className="text-sm text-muted-foreground">{account.category}</p>
              </div>
            </div>

            {/* Acesso individual entregue */}
            {isIndividual && (
              <div className="mb-4">
                {loadingDelivery ? (
                  <div className="p-4 rounded-xl bg-accent/50 text-sm text-muted-foreground">Carregando seu acesso...</div>
                ) : delivered ? (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                    <p className="text-xs text-primary mb-1">🎯 Seu acesso exclusivo</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-foreground break-all flex-1">{delivered}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => copyToClipboard(delivered, "Acesso")} className="p-2 rounded-lg hover:bg-accent transition-colors">
                          <Copy className="w-4 h-4 text-primary" />
                        </button>
                        {delivered.startsWith("http") && (
                          <a href={delivered} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-accent transition-colors">
                            <ExternalLink className="w-4 h-4 text-primary" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-300">
                    Estoque esgotado no momento. O admin foi notificado.
                  </div>
                )}
              </div>
            )}

            {/* Compartilhado: credenciais comuns */}
            {!isIndividual && (
              <div className="space-y-4">
                {loadingDelivery && (
                  <div className="p-4 rounded-xl bg-accent/50 text-sm text-muted-foreground">Carregando seu acesso...</div>
                )}
                {!loadingDelivery && delivered && (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                    <p className="text-xs text-primary mb-1">🎯 Seu acesso ativo {deliveredLabel ? `· ${deliveredLabel}` : ""}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-foreground break-all flex-1 whitespace-pre-wrap">{delivered}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => copyToClipboard(delivered, "Acesso")} className="p-2 rounded-lg hover:bg-accent transition-colors">
                          <Copy className="w-4 h-4 text-primary" />
                        </button>
                        {delivered.startsWith("http") && (
                          <a href={delivered} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-accent transition-colors">
                            <ExternalLink className="w-4 h-4 text-primary" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {!loadingDelivery && !delivered && (account.email || account.password || account.main_link) && (
                  <>
                    {account.email && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50">
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm text-foreground">{account.email}</p>
                        </div>
                        <button onClick={() => copyToClipboard(account.email!, "Email")} className="p-2 rounded-lg hover:bg-accent transition-colors">
                          <Copy className="w-4 h-4 text-primary" />
                        </button>
                      </div>
                    )}
                    {account.password && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50">
                        <div>
                          <p className="text-xs text-muted-foreground">Senha</p>
                          <p className="text-sm text-foreground font-mono">{showPassword ? account.password : "••••••••••"}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setShowPassword(!showPassword)} className="p-2 rounded-lg hover:bg-accent transition-colors">
                            {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <button onClick={() => copyToClipboard(account.password!, "Senha")} className="p-2 rounded-lg hover:bg-accent transition-colors">
                            <Copy className="w-4 h-4 text-primary" />
                          </button>
                        </div>
                      </div>
                    )}
                    {account.main_link && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Link principal</p>
                          <p className="text-sm text-primary truncate">{account.main_link}</p>
                        </div>
                        <a href={account.main_link} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0">
                          <ExternalLink className="w-4 h-4 text-primary" />
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {account.observations && (
              <div className="p-3 rounded-xl bg-accent/50 mt-4">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm text-foreground mt-1">{account.observations}</p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border">
              {!showSupport ? (
                <button
                  onClick={() => setShowSupport(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 transition-colors text-sm font-medium"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Reportar problema (login inválido, créditos esgotados, etc.)
                </button>
              ) : (
                <div className="space-y-3">
                  {deliveredItemId ? (
                    <>
                      <p className="text-xs text-muted-foreground">Selecione o motivo. Se houver outro acesso disponível, ele será entregue automaticamente.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {([
                          ["login_invalido", "Login inválido"],
                          ["sem_creditos", "Créditos esgotados"],
                          ["outro", "Outro problema"],
                        ] as const).map(([val, lbl]) => (
                          <button key={val} onClick={() => setReportReason(val)} className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${reportReason === val ? "bg-primary text-primary-foreground border-primary" : "bg-accent text-muted-foreground border-border hover:text-foreground"}`}>{lbl}</button>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowSupport(false)} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border">Cancelar</button>
                        <button onClick={reportIssue} disabled={reporting} className="gradient-neon px-5 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow flex items-center gap-2 disabled:opacity-50">
                          <Send className="w-4 h-4" />{reporting ? "Enviando..." : "Reportar"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <textarea
                        value={supportMsg}
                        onChange={(e) => setSupportMsg(e.target.value.slice(0, 900))}
                        placeholder="Descreva o problema (link cheio, erro de acesso, etc.)..."
                        className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{supportMsg.length}/900</p>
                        <div className="flex gap-2">
                          <button onClick={() => { setShowSupport(false); setSupportMsg(""); }} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border">Cancelar</button>
                          <button onClick={submitSupport} disabled={sending} className="gradient-neon px-5 py-2 rounded-xl text-sm font-semibold text-primary-foreground neon-glow flex items-center gap-2 disabled:opacity-50">
                            <Send className="w-4 h-4" />{sending ? "Enviando..." : "Enviar"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

