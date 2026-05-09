import type { Editor, BlockProperties } from "grapesjs";

const blocks: BlockProperties[] = [
  {
    id: "pcl-btn-anchor",
    label: "Botão → Âncora",
    category: "Animações",
    media: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
    content: `<a class="pcl-btn pcl-fx-glow" data-action="scroll-anchor" data-target="#contato" style="background:#00B4FF;color:#fff;">Ir para seção</a>`,
  },
  {
    id: "pcl-btn-top",
    label: "Botão Topo",
    category: "Animações",
    media: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    content: `<a class="pcl-btn pcl-fx-pulse" data-action="scroll-top" style="background:#7A00FF;color:#fff;">Voltar ao topo</a>`,
  },
  {
    id: "pcl-btn-bottom",
    label: "Botão Base",
    category: "Animações",
    media: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    content: `<a class="pcl-btn pcl-fx-shine" data-action="scroll-bottom" style="background:#00B4FF;color:#fff;">Ir até o final</a>`,
  },
  {
    id: "pcl-fade-in",
    label: "Fade-in ao rolar",
    category: "Animações",
    media: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>',
    content: `<div data-anim="fade" style="padding:40px;text-align:center;"><h2>Aparece com fade</h2><p>Edite este conteúdo.</p></div>`,
  },
  {
    id: "pcl-slide-up",
    label: "Slide-up ao rolar",
    category: "Animações",
    media: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    content: `<div data-anim="slide" style="padding:40px;text-align:center;"><h2>Sobe ao aparecer</h2><p>Edite este conteúdo.</p></div>`,
  },
  {
    id: "pcl-parallax",
    label: "Section Parallax",
    category: "Animações",
    content: `<section data-parallax style="background-image:linear-gradient(135deg,#0b0f19,#1a1f3a);min-height:380px;display:flex;align-items:center;justify-content:center;color:#fff;"><div style="text-align:center;padding:40px;"><h2 style="font-size:2.4rem;">Seção com Parallax</h2><p>Background fixo enquanto rola</p></div></section>`,
  },
  {
    id: "pcl-video-yt",
    label: "Vídeo (YouTube)",
    category: "Mídia",
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>`,
  },
  {
    id: "pcl-html-custom",
    label: "HTML Custom",
    category: "Avançado",
    content: { type: "custom-code" },
  },
];

export function registerPageClonerBlocks(editor: Editor) {
  blocks.forEach((b) => editor.BlockManager.add(b.id!, b));

  // Trait extra para qualquer link/button: ação de rolagem
  const linkType = editor.DomComponents.getType("link");
  if (linkType) {
    editor.DomComponents.addType("link", {
      model: {
        defaults: {
          ...linkType.model.prototype.defaults,
          traits: [
            ...(linkType.model.prototype.defaults.traits as any[]),
            { type: "select", name: "data-action", label: "Ação", options: [
              { id: "", name: "Nenhuma" },
              { id: "scroll-anchor", name: "Rolar para âncora" },
              { id: "scroll-top", name: "Rolar para o topo" },
              { id: "scroll-bottom", name: "Rolar para o final" },
            ] },
            { type: "text", name: "data-target", label: "Alvo (#id)", placeholder: "#contato" },
            { type: "select", name: "fx", label: "Efeito hover", changeProp: true, options: [
              { id: "", name: "Nenhum" },
              { id: "pcl-fx-pulse", name: "Pulse" },
              { id: "pcl-fx-glow", name: "Glow" },
              { id: "pcl-fx-shine", name: "Shine" },
            ] },
          ],
        },
        init() {
          (this as any).on("change:fx", (m: any) => {
            const v = m.get("fx") || "";
            const cls = (m.getClasses() || []).filter((c: string) => !c.startsWith("pcl-fx-"));
            if (v) cls.push(v);
            m.setClass(cls);
          });
        },
      } as any,
    });
  }
}
