import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Zap, Link2, RefreshCw, Headphones, Check } from "lucide-react";
import { InfinityLogo } from "@/components/InfinityLogo";

export const Route = createFileRoute("/67")({
  component: LP67,
  head: () => ({
    meta: [
      { title: "Oferta Especial 67 — Infinity I.A" },
      { name: "description", content: "Oferta especial: acesso premium a contas Plus por apenas R$67" },
    ],
  }),
});

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
  }),
};

function LP67() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20" style={{ background: "radial-gradient(ellipse, oklch(0.65 0.22 250 / 40%), transparent 70%)" }} />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <InfinityLogo size={40} />
          <span className="font-bold text-lg text-foreground">INFINITY I.A</span>
        </div>
        <Link to="/acess" className="gradient-neon px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground neon-glow">Acessar</Link>
      </nav>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <InfinityLogo size={80} />
        </motion.div>
        <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1} className="mt-8 text-5xl md:text-7xl font-extrabold">
          <span className="gradient-neon-text">INFINITY I.A</span>
        </motion.h1>
        <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2} className="mt-3 text-primary text-lg font-medium tracking-widest uppercase">
          Oferta Especial
        </motion.p>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="mt-8 glass-strong rounded-3xl p-8 max-w-md mx-auto neon-glow-strong">
          <p className="text-muted-foreground text-sm line-through">De R$197,00</p>
          <p className="text-5xl font-extrabold gradient-neon-text mt-2">R$67,00</p>
          <p className="text-muted-foreground mt-2">Acesso vitalício a todas as contas premium</p>
          <div className="mt-6 space-y-2 text-left">
            {["Acesso a +20 contas premium", "Atualizações constantes", "Suporte dedicado 24/7", "Acesso vitalício"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
          <a href="#" className="mt-6 block gradient-neon px-8 py-4 rounded-2xl font-bold text-primary-foreground text-lg neon-glow-strong text-center">
            QUERO ACESSO AGORA
          </a>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border py-8 text-center mt-16">
        <p className="text-sm text-muted-foreground">© 2024 Infinity I.A — Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
