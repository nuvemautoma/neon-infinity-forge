// Vercel serverless function — GET /api/health
// Health check simples para verificar se o deploy está vivo.

export default async function handler(_req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "infinity-ia",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
