import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ExternalLink, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
}

interface AccountDetailModalProps {
  account: AccountDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AccountDetailModal({ account, isOpen, onClose }: AccountDetailModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
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
            className="glass-strong rounded-3xl p-8 w-full max-w-lg relative z-10 neon-glow"
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
              <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${account.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {account.status === "active" ? "Disponível" : "Indisponível"}
              </span>
            </div>

            <div className="space-y-4">
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

              {account.extra_links && account.extra_links.length > 0 && (
                <div className="p-3 rounded-xl bg-accent/50">
                  <p className="text-xs text-muted-foreground mb-2">Links extras</p>
                  {account.extra_links.map((link, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <p className="text-sm text-primary truncate">{link.url}</p>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-accent transition-colors shrink-0">
                        <ExternalLink className="w-3 h-3 text-primary" />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {account.observations && (
                <div className="p-3 rounded-xl bg-accent/50">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm text-foreground mt-1">{account.observations}</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
