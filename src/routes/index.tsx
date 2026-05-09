import { createFileRoute } from "@tanstack/react-router";
import landingHtml from "@/landing-content.html?raw";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Infinity I.A — Acesso Premium a Contas Plus" },
      { name: "description", content: "Plataforma premium de entrega de contas Plus. Acesso exclusivo a serviços premium com segurança e suporte dedicado." },
    ],
  }),
});

function LandingPage() {
  return (
    <iframe
      title="Landing Page"
      srcDoc={landingHtml}
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation"
      className="w-screen h-screen border-0 block"
    />
  );
}
