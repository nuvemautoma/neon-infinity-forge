import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Wand2, Globe, Plus } from "lucide-react";
import { toast } from "sonner";
import { generateHtmlAi } from "@/lib/html-ai.functions";

interface Props {
  currentHtml: string;
  onResult: (html: string) => void;
  allowCreate?: boolean;
  allowClone?: boolean;
  label?: string;
}

export function HtmlAiPanel({ currentHtml, onResult, allowCreate = true, allowClone = true, label = "IA Editora de HTML" }: Props) {
  const fn = useServerFn(generateHtmlAi);
  const [mode, setMode] = useState<"edit" | "create" | "clone">("edit");
  const [prompt, setPrompt] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (mode !== "clone" && !prompt.trim()) { toast.error("Descreva o que deseja"); return; }
    if (mode === "clone" && !cloneUrl.trim()) { toast.error("Informe a URL para clonar"); return; }
    setLoading(true);
    try {
      const r = await fn({ data: { mode, prompt, currentHtml, cloneUrl: cloneUrl || undefined } });
      onResult(r.html);
      toast.success("HTML atualizado pela IA!");
      setPrompt("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar HTML");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5 border border-primary/30 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">{label}</h3>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setMode("edit")} className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${mode === "edit" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
          <Wand2 className="w-3 h-3" /> Editar / Corrigir
        </button>
        {allowCreate && (
          <button onClick={() => setMode("create")} className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${mode === "create" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
            <Plus className="w-3 h-3" /> Criar do zero
          </button>
        )}
        {allowClone && (
          <button onClick={() => setMode("clone")} className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${mode === "clone" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
            <Globe className="w-3 h-3" /> Clonar URL
          </button>
        )}
      </div>

      {mode === "clone" && (
        <input
          value={cloneUrl}
          onChange={(e) => setCloneUrl(e.target.value)}
          placeholder="https://exemplo.com/pagina-para-clonar"
          className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm"
        />
      )}

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          mode === "edit"
            ? "Ex: 'Mude o título para Infinity I.A, troque a cor de fundo para preto neon e adicione um botão CTA grande'"
            : mode === "create"
            ? "Ex: 'Landing page dark com neon azul para SaaS de IA, hero, features, planos e footer'"
            : "Ajustes opcionais após clonar (ex: 'troque logos por Infinity I.A')"
        }
        className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm h-24 resize-none"
      />

      <button
        onClick={run}
        disabled={loading}
        className="gradient-neon px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground neon-glow disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? (
          <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Gerando...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Gerar com IA</>
        )}
      </button>
      <p className="text-xs text-muted-foreground">A IA reescreve todo o HTML. Revise antes de salvar. Lembre-se de clicar em "Salvar" para aplicar.</p>
    </div>
  );
}
