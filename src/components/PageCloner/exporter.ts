import JSZip from "jszip";
import { RUNTIME_CSS, RUNTIME_JS } from "./runtime";

const HTML_LIMIT = 4 * 1024 * 1024;

function buildFullHtml(bodyHtml: string, css: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${RUNTIME_CSS}\n${css}</style>
</head>
<body>
${bodyHtml}
<script>${RUNTIME_JS}</script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c],
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Tenta converter URLs http(s) das <img> e background-image para base64 via canvas. */
async function inlineRemainingImages(html: string): Promise<string> {
  const urls = new Set<string>();
  const re1 = /<img\b[^>]*\bsrc=["'](https?:[^"']+)["']/gi;
  const re2 = /url\((['"]?)(https?:[^'")]+)\1\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) urls.add(m[1]);
  while ((m = re2.exec(html)) !== null) urls.add(m[2]);

  for (const u of urls) {
    try {
      const r = await fetch(u, { mode: "cors" });
      if (!r.ok) continue;
      const blob = await r.blob();
      const dataUri: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(blob);
      });
      html = html.split(u).join(dataUri);
    } catch {
      /* CORS bloqueado — mantém URL */
    }
  }
  return html;
}

export async function exportPage(opts: {
  bodyHtml: string;
  css: string;
  title: string;
}): Promise<{ ok: true; mode: "html" | "zip"; bytes: number } | { ok: false; error: string }> {
  try {
    const inlined = await inlineRemainingImages(opts.bodyHtml);
    const fullHtml = buildFullHtml(inlined, opts.css, opts.title);
    const safeName = opts.title.replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-").toLowerCase() || "pagina";

    if (fullHtml.length <= HTML_LIMIT) {
      downloadBlob(new Blob([fullHtml], { type: "text/html;charset=utf-8" }), `${safeName}.html`);
      return { ok: true, mode: "html", bytes: fullHtml.length };
    }

    // Fallback: ZIP com index.html + extrai imagens base64 grandes para /images
    const zip = new JSZip();
    const imgs = zip.folder("images")!;
    let counter = 0;
    const replaced = fullHtml.replace(/data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)/g, (_full, mime, b64) => {
      if (b64.length < 80_000) return _full; // base64 pequeno fica inline
      counter += 1;
      const ext = mime.split("/")[1].split("+")[0];
      const filename = `img-${counter}.${ext}`;
      imgs.file(filename, b64, { base64: true });
      return `images/${filename}`;
    });
    zip.file("index.html", replaced);
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${safeName}.zip`);
    return { ok: true, mode: "zip", bytes: blob.size };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao gerar arquivo" };
  }
}
