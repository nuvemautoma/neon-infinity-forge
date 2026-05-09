import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Download, ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { exportPage } from "./exporter";
import { registerPageClonerBlocks } from "./blocks";

type Props = {
  pageId: string;
  initialName: string;
  initialHtml: string;
  initialEditorData?: any;
};

export function PageClonerEditor({ pageId, initialName, initialHtml, initialEditorData }: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const grapesjs = (await import("grapesjs")).default;
      await import("grapesjs/dist/css/grapes.min.css");
      const presetWebpage = (await import("grapesjs-preset-webpage")).default;
      const blocksBasic = (await import("grapesjs-blocks-basic")).default;
      const pluginForms = (await import("grapesjs-plugin-forms")).default;
      const styleBg = (await import("grapesjs-style-bg")).default;
      const customCode = (await import("grapesjs-custom-code")).default;
      const tabsPlugin = (await import("grapesjs-tabs")).default;

      if (cancelled || !containerRef.current) return;

      const editor = grapesjs.init({
        container: containerRef.current,
        height: "100%",
        width: "100%",
        fromElement: false,
        storageManager: false,
        plugins: [blocksBasic, presetWebpage, pluginForms, styleBg, customCode, tabsPlugin],
        pluginsOpts: {
          [blocksBasic as any]: { flexGrid: true },
          [presetWebpage as any]: {},
        },
        canvas: { styles: [] },
      });

      registerPageClonerBlocks(editor);

      if (initialEditorData && Object.keys(initialEditorData).length > 0) {
        try { editor.loadProjectData(initialEditorData); } catch { /* fallback abaixo */ }
      } else if (initialHtml) {
        const parsed = extractHtmlAndCss(initialHtml);
        editor.setComponents(parsed.html);
        if (parsed.css) editor.setStyle(parsed.css);
      } else {
        editor.setComponents(
          `<section style="padding:60px 20px;text-align:center;background:#0b0f19;color:#fff;"><h1>Comece a editar</h1><p>Arraste blocos da esquerda.</p></section>`,
        );
      }

      editorRef.current = editor;
      setLoading(false);

      // Auto-save a cada 20s
      const t = setInterval(() => save(true), 20_000);
      (editor as any).__autosaveT = t;
    })();

    return () => {
      cancelled = true;
      try {
        if (editorRef.current?.__autosaveT) clearInterval(editorRef.current.__autosaveT);
        editorRef.current?.destroy();
      } catch { /* */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (silent = false) => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const projectData = editorRef.current.getProjectData();
      const { error } = await supabase
        .from("cloned_pages")
        .update({ name, editor_data: projectData })
        .eq("id", pageId);
      if (error) throw error;
      if (!silent) toast.success("Salvo!");
    } catch (e: any) {
      if (!silent) toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!editorRef.current) return;
    setExporting(true);
    try {
      await save(true);
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      const r = await exportPage({ bodyHtml: html, css, title: name });
      if (r.ok) {
        toast.success(`Arquivo gerado (${(r.bytes / 1024).toFixed(0)} KB) — formato ${r.mode.toUpperCase()}`);
      } else {
        toast.error(r.error);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card gap-3">
        <button
          onClick={() => navigate({ to: "/cloner" })}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 max-w-md bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => save(false)}
            disabled={saving || loading}
            className="px-4 py-2 rounded-xl text-sm border border-border text-foreground flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="gradient-neon px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground flex items-center gap-2 neon-glow disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Publicar e baixar
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
  const bodyMatch = full.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const html = bodyMatch ? bodyMatch[1] : full;
  const styles: string[] = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(full)) !== null) styles.push(m[1]);
  return { html, css: styles.join("\n") };
}
