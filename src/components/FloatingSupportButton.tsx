import { useEffect, useState } from "react";
import { MessageCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function FloatingSupportButton() {
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("support_whatsapp, support_email")
        .limit(1)
        .maybeSingle();
      setWhatsapp(((data as any)?.support_whatsapp || "").trim());
      setEmail(((data as any)?.support_email || "").trim());
    })();
  }, []);

  if (!whatsapp && !email) return null;

  const href = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}`
    : `mailto:${email}`;
  const Icon = whatsapp ? MessageCircle : Mail;
  const label = whatsapp ? "Suporte" : "E-mail";
  const ring = whatsapp ? "bg-green-500 hover:bg-green-400" : "bg-primary hover:bg-primary/90";

  return (
    <a
      href={href}
      target={whatsapp ? "_blank" : undefined}
      rel={whatsapp ? "noopener noreferrer" : undefined}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full text-white font-semibold shadow-2xl ${ring} transition-all hover:scale-105 group`}
      style={{ boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.06)" }}
      title={whatsapp ? "Falar no WhatsApp" : `Enviar e-mail: ${email}`}
    >
      <Icon className="w-5 h-5" />
      <span className="hidden sm:inline">{label}</span>
      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white animate-ping opacity-60" />
      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white" />
    </a>
  );
}
