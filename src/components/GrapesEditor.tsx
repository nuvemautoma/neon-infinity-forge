import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";

type Props = {
  initialHtml: string;
  onSave: (html: string) => Promise<void> | void;
  onClose: () => void;
  title?: string;
};

/**
 * Editor visual estilo Canva/Webflow (GrapesJS) para editar a landing/afiliados
 * arrastando blocos, alterando textos e links inline.
 */
export function GrapesEditor({ initialHtml, onSave, onClose, title = "Editor Visual" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Imports dinâmicos: GrapesJS é grande e usa window — só carrega no cliente
      const grapesjs = (await import("grapesjs")).default;
      await import("grapesjs/dist/css/grapes.min.css");
      const presetWebpage = (await import("grapesjs-preset-webpage")).default;
      const blocksBasic = (await import("grapesjs-blocks-basic")).default;

      if (cancelled || !containerRef.current) return;

      // Extrai <body>...</body> + <style> do HTML salvo para alimentar o editor
      const parsed = extractHtmlAndCss(initialHtml);

      const editor = grapesjs.init({
        container: containerRef.current,
        height: "100%",
        width: "100%",
        fromElement: false,
        storageManager: false,
        plugins: [blocksBasic, presetWebpage],
        pluginsOpts: {
          [blocksBasic as any]: { flexGrid: true },
          [presetWebpage as any]: {},
        },
        canvas: {
          styles: [],
        },
      });

      editor.setComponents(parsed.html || "<section style='padding:40px;text-align:center;color:#fff;background:#0b0f19'><h1>Comece a editar</h1><p>Arraste blocos do painel direito.</p></section>");
      if (parsed.css) editor.setStyle(parsed.css);

      editorRef.current = editor;
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      try { editorRef.current?.destroy(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      const fullHtml = buildFullHtml(html, css);
      await onSave(fullHtml);
      toast.success("Salvo! A página foi atualizada em tempo real.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground flex items-center gap-2">
            <X className="w-4 h-4" /> Fechar
          </button>
        </div>
      </div>
      <div className="flex-1 relative bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando editor visual…</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

function extractHtmlAndCss(full: string): { html: string; css: string } {
  if (!full) return { html: "", css: "" };
  // Pega tudo entre <body>...</body>
  const bodyMatch = full.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const html = bodyMatch ? bodyMatch[1] : full;
  // Junta todos os <style>...</style>
  const styles: string[] = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(full)) !== null) styles.push(m[1]);
  return { html, css: styles.join("\n") };
}

function buildFullHtml(bodyHtml: string, css: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Página</title>
<style>${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
