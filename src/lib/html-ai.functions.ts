import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  mode: z.enum(["edit", "create", "clone"]),
  prompt: z.string().max(4000).optional().default(""),
  currentHtml: z.string().max(200000).optional().default(""),
  cloneUrl: z.string().url().optional(),
});

const SYSTEM = `Você é um especialista em HTML/CSS. Retorne SEMPRE um documento HTML completo, válido e auto-contido (com <!DOCTYPE html>, <html>, <head> com <style> embutido, e <body>). Nunca retorne markdown, nunca envolva em \`\`\`. Apenas o HTML puro. Mantenha responsividade, acessibilidade e visual moderno. Não use scripts externos a não ser que o usuário peça. Preserve imagens e links existentes a menos que o usuário peça para remover.`;

function stripFences(s: string) {
  return s.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export const generateHtmlAi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    let userMsg = "";
    if (data.mode === "create") {
      userMsg = `Crie uma landing page completa baseada no seguinte pedido:\n\n${data.prompt}`;
    } else if (data.mode === "clone") {
      if (!data.cloneUrl) throw new Error("cloneUrl obrigatório no modo clone");
      let cloned = "";
      try {
        const r = await fetch(data.cloneUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        cloned = await r.text();
        if (cloned.length > 80000) cloned = cloned.slice(0, 80000);
      } catch (e) {
        throw new Error("Falha ao baixar URL para clonar");
      }
      userMsg = `Clone visualmente o site abaixo, recriando o HTML/CSS auto-contido em um único arquivo. ${data.prompt ? `Ajustes pedidos: ${data.prompt}` : ""}\n\n--- HTML ORIGINAL ---\n${cloned}`;
    } else {
      userMsg = `Edite o HTML abaixo conforme o pedido. Retorne o HTML completo modificado.\n\nPEDIDO:\n${data.prompt}\n\n--- HTML ATUAL ---\n${data.currentHtml || "(vazio — gere do zero conforme o pedido)"}`;
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de requisições excedido. Aguarde um instante.");
      if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione saldo no workspace.");
      const t = await res.text();
      throw new Error(`Erro IA: ${res.status} ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    const html = stripFences(content);
    if (!html) throw new Error("Resposta vazia da IA");
    return { html };
  });
