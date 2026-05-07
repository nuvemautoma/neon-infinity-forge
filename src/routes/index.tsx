import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Zap, Link2, RefreshCw, Headphones, Check } from "lucide-react";
import { InfinityLogo } from "@/components/InfinityLogo";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Infinity I.A — Acesso Premium a Contas Plus" },
      { name: "description", content: "Plataforma premium de entrega de contas Plus. Acesso exclusivo a serviços premium com segurança e suporte dedicado." },
    ],
  }),
});

const features = [
  { icon: Shield, title: "Segurança", desc: "Dados protegidos com criptografia de ponta" },
  { icon: Zap, title: "Acesso Instantâneo", desc: "Liberação automática após a compra" },
  { icon: Link2, title: "Links Exclusivos", desc: "Acesse contas premium verificadas" },
  { icon: RefreshCw, title: "Atualizações", desc: "Contas sempre atualizadas e funcionando" },
  { icon: Headphones, title: "Suporte 24/7", desc: "Suporte dedicado para membros" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20" style={{ background: "radial-gradient(ellipse, oklch(0.65 0.22 250 / 40%), transparent 70%)" }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <InfinityLogo size={40} />
          <span className="font-bold text-lg text-foreground">INFINITY I.A</span>
        </div>
        <Link to="/acess" className="gradient-neon px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 neon-glow">
          Acessar
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <InfinityLogo size={100} />
        </motion.div>
        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
          className="mt-8 text-5xl md:text-7xl font-extrabold tracking-tight"
        >
          <span className="gradient-neon-text">INFINITY I.A</span>
        </motion.h1>
        <motion.p
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={2}
          className="mt-3 text-primary text-lg font-medium tracking-widest uppercase"
        >
          Entrega de Contas Plus
        </motion.p>
        <motion.p
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={3}
          className="mt-6 text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed"
        >
          Acesse as melhores plataformas premium com segurança, praticidade e suporte dedicado. Sua experiência começa aqui.
        </motion.p>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/acess" className="gradient-neon px-8 py-4 rounded-2xl font-bold text-primary-foreground text-lg neon-glow-strong transition-all hover:opacity-90">
            Começar Agora
          </Link>
        </motion.div>

        {/* Feature list */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="mt-16 flex flex-col items-start max-w-sm mx-auto gap-3">
          {["ACESSO PREMIUM", "SEGURANÇA", "LINKS EXCLUSIVOS", "ATUALIZAÇÕES CONSTANTES", "SUPORTE DEDICADO"].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-foreground font-medium">{item}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-32">
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold text-center mb-16">
          Por que escolher a <span className="gradient-neon-text">Infinity I.A</span>?
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
              className="glass rounded-2xl p-6 text-center hover-lift"
            >
              <div className="w-12 h-12 rounded-xl gradient-neon flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">© 2024 Infinity I.A — Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
