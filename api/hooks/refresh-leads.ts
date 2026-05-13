// Vercel serverless function — POST /api/hooks/refresh-leads
// Atualização programada dos leads (a cada 2 dias via cron).
// Para a lógica completa de scraping (que depende de imports do app),
// este endpoint faz proxy para o endpoint TanStack Start original.
// Configure TANSTACK_ORIGIN_URL no ambiente da Vercel apontando
// para o domínio onde o TanStack Start está hospedado.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const origin = process.env.TANSTACK_ORIGIN_URL;
  if (!origin) {
    return json(
      { error: "TANSTACK_ORIGIN_URL not configured on Vercel env vars" },
      503,
    );
  }

  try {
    const target = `${origin.replace(/\/+$/, "")}/api/public/hooks/refresh-leads`;
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[refresh-leads] proxy error:", error);
    return json({ error: "Failed to call upstream" }, 502);
  }
}
