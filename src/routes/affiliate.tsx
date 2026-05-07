import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InfinityLogo } from "@/components/InfinityLogo";
import { toast } from "sonner";
import { Toaster } from "sonner";

export const Route = createFileRoute("/affiliate")({
  component: AffiliatePage,
  head: () => ({ meta: [{ title: "Afiliar-me — Infinity I.A" }] }),
});

function AffiliatePage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      const { data } = await supabase.from("affiliate_links").select("*").eq("is_active", true).order("sort_order");
      setLinks(data || []);
      setLoading(false);
    };
    check();
  }, [navigate]);

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" theme="dark" />
      <header className="glass-strong border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <InfinityLogo size={36} />
            <span className="font-bold text-foreground">INFINITY I.A</span>
          </div>
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Voltar</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground mb-2">Afiliar-me</h1>
          <p className="text-muted-foreground mb-8">Divulgue e ganhe comissões exclusivas</p>
        </motion.div>

        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-xl bg-accent" /><div className="flex-1"><div className="h-4 bg-accent rounded w-1/2 mb-2" /><div className="h-3 bg-accent rounded w-1/3" /></div></div>
              </div>
            ))
          ) : (
            links.map((link, i) => (
              <motion.div key={link.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl gradient-neon flex items-center justify-center overflow-hidden">
                    {link.image_url ? <img src={link.image_url} alt={link.name} className="w-full h-full object-cover" /> : <Share2 className="w-7 h-7 text-primary-foreground" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{link.name}</p>
                    <p className="text-sm text-primary">Comissão {link.commission || "N/A"}</p>
                    {link.description && <p className="text-xs text-muted-foreground mt-1">{link.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={link.affiliate_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-xs font-medium rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors">Saiba mais</a>
                  <button onClick={() => copyLink(link.affiliate_url)} className="gradient-neon px-4 py-2 rounded-xl text-xs font-semibold text-primary-foreground neon-glow">Copiar link</button>
                </div>
              </motion.div>
            ))
          )}
          {!loading && links.length === 0 && (
            <div className="text-center py-16">
              <Share2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum programa de afiliados disponível no momento.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
