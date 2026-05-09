import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_HTML_BYTES = 8 * 1024 * 1024;
const MAX_IMG_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT = 25_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeout = FETCH_TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "*/*", ...(init.headers || {}) },
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

async function urlToDataURI(url: string, base: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return url;
    const abs = absolutize(url, base);
    if (!/^https?:/i.test(abs)) return null;
    const res = await fetchWithTimeout(abs, {}, 15_000);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMG_BYTES) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

async function inlineCSSLinks(html: string, base: string): Promise<string> {
  const linkRe = /<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi;
  const links = html.match(linkRe) || [];
  for (const tag of links) {
    const hrefM = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefM) continue;
    const cssUrl = absolutize(hrefM[1], base);
    try {
      const r = await fetchWithTimeout(cssUrl, {}, 12_000);
      if (!r.ok) continue;
      let css = await r.text();
      // resolve url(...) relativas dentro do CSS
      css = css.replace(/url\((['"]?)([^'")]+)\1\)/g, (_m, q, u) => {
        if (u.startsWith("data:") || u.startsWith("#")) return `url(${q}${u}${q})`;
        return `url(${q}${absolutize(u, cssUrl)}${q})`;
      });
      html = html.replace(tag, `<style data-from="${cssUrl}">${css}</style>`);
    } catch {
      /* ignora */
    }
  }
  return html;
}

async function inlineImages(html: string, base: string): Promise<string> {
  // <img src=...>
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const tasks: Array<Promise<void>> = [];
  const replacements: Array<[string, string]> = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const original = m[0];
    const src = m[1];
    tasks.push(
      (async () => {
        const data = await urlToDataURI(src, base);
        if (data) replacements.push([original, original.replace(src, data)]);
      })(),
    );
  }
  // background-image: url(...)
  const bgRe = /background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/gi;
  while ((m = bgRe.exec(html)) !== null) {
    const original = m[0];
    const src = m[2];
    tasks.push(
      (async () => {
        const data = await urlToDataURI(src, base);
        if (data) replacements.push([original, `background-image:url(${data})`]);
      })(),
    );
  }
  await Promise.all(tasks);
  for (const [from, to] of replacements) html = html.split(from).join(to);
  return html;
}

function sanitize(html: string): string {
  // Remove scripts e iframes de tracking
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  html = html.replace(/<meta\b[^>]*http-equiv=["']?refresh[^>]*>/gi, "");
  html = html.replace(/\son\w+=("[^"]*"|'[^']*')/gi, "");
  return html;
}

function looksEmpty(html: string): boolean {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length < 200;
}

async function firecrawlScrape(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["html", "rawHtml"], onlyMainContent: false }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.data?.html || data?.data?.rawHtml || data?.html || data?.rawHtml || null;
  } catch {
    return null;
  }
}

const inputSchema = z.object({ url: z.string().url().max(2048) });

export const clonePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const url = data.url;
    let html = "";
    let usedFirecrawl = false;

    try {
      const r = await fetchWithTimeout(url, {}, 20_000);
      if (r.ok) {
        const text = await r.text();
        if (text.length < MAX_HTML_BYTES) html = text;
      }
    } catch {
      /* fallback abaixo */
    }

    if (!html || looksEmpty(html)) {
      const fc = await firecrawlScrape(url);
      if (fc) {
        html = fc;
        usedFirecrawl = true;
      }
    }

    if (!html) {
      return {
        ok: false as const,
        error:
          "Não consegui baixar o HTML deste site. Pode estar protegido por anti-bot. Tente outra URL.",
      };
    }

    html = sanitize(html);
    html = await inlineCSSLinks(html, url);
    html = await inlineImages(html, url);

    // Adiciona <base> só pra resolver fontes/links remanescentes na pré-visualização
    if (!/<base\s/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${url}">`);
    }

    return { ok: true as const, html, usedFirecrawl };
  });
