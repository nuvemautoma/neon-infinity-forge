# API endpoints (formato Vercel)

Esta pasta segue o padrão da Vercel: cada arquivo `.ts` dentro de `/api`
vira automaticamente uma serverless function acessível pelo mesmo path.

## Convenção

```
api/health.ts                -> GET  /api/health
api/webhook/cakto.ts         -> POST /api/webhook/cakto
api/hooks/refresh-leads.ts   -> POST /api/hooks/refresh-leads
```

Cada handler usa o formato **Web Standard** suportado nativamente pela
Vercel (compatível tanto com runtime Node quanto Edge):

```ts
export default async function handler(req: Request): Promise<Response> {
  return new Response("ok");
}
```

## Variáveis de ambiente necessárias na Vercel

Configure no dashboard da Vercel (Settings → Environment Variables):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CAKTO_WEBHOOK_SECRET`
- `CAKTO_PRODUCT_PLUS` (opcional, IDs separados por vírgula)
- `CAKTO_PRODUCT_ENTERPRISE` (opcional)
- `CAKTO_OFFER_PLUS` (opcional)
- `CAKTO_OFFER_ENTERPRISE` (opcional)

> Os mesmos endpoints continuam disponíveis via TanStack Start em
> `/api/public/...` quando o app é executado pelo runtime principal.
> Esta pasta `/api` existe para que a Vercel reconheça e sirva
> os endpoints como serverless functions independentes.
