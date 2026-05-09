## Visão geral

Dois módulos novos:

1. **Extração** (`/leads/extrair`): formulário (país, estado, cidade, nicho, nome opcional) → lista de comércios com foto, telefone, email, estrelas, endereço, descrição, site → botão "Salvar lead".
2. **CRM Kanban** (`/leads`): quadro com colunas customizáveis, drag-and-drop, etiquetas coloridas com nome livre, criação manual, realtime entre abas/dispositivos.

Acesso controlado por plano (igual ao que já fizemos pra outras features), admin sempre tem.

## Fonte de dados — estratégia híbrida

**Padrão (grátis, sem chave):** Overpass API do OpenStreetMap. Busca por `amenity`/`shop`/`craft` + nome opcional dentro do bounding box da cidade (geocodificada via Nominatim, também grátis). Retorna nome, endereço, telefone (quando existe), site, coords. Estrelas/foto raramente vêm.

**Opcional (qualidade alta):** se o admin colar uma `GOOGLE_PLACES_API_KEY` nas configurações, aparece toggle "Usar Google Places" no formulário. Aí usamos `Text Search` + `Place Details` (foto, rating, telefone formatado, site, horário). Crédito grátis ~$200/mês do Google cobre milhares de buscas.

**Email (sempre que tiver site):** depois de listar os comércios, pra cada um que tem site disparamos uma raspagem leve via **Firecrawl** (conector já presente no projeto) na home + `/contato`/`/contact` e extraímos `mailto:` ou regex de email no HTML. Com cache no banco pra não reprocessar o mesmo domínio.

## Banco de dados

Migration nova com 3 tabelas + 1 coluna em `site_settings`:

- **`leads`**: `user_id`, `name`, `phone`, `email`, `website`, `address`, `lat`, `lng`, `rating`, `reviews_count`, `photo_url`, `description`, `category`, `source` (`osm`|`google`|`manual`), `external_id`, `column_id` (FK), `position` (int, ordenação dentro da coluna), `notes`.
- **`lead_columns`**: `user_id`, `name`, `color`, `position`. Seed automático ao primeiro acesso: "Novo", "Em contato", "Negociando", "Fechado", "Perdido".
- **`lead_tags`**: `user_id`, `name`, `color`. Relação N-N com leads via `lead_tag_assignments` (`lead_id`, `tag_id`).
- **`site_settings.google_places_api_key`** (text, só admin lê/escreve via RLS) e **`site_settings.leads_allowed_plans`** (text[]).
- **`email_scrape_cache`**: `domain`, `email`, `scraped_at` (TTL de 30 dias).

RLS: cada usuário só vê o que é seu (`user_id = auth.uid()`); admin vê tudo. Realtime habilitado em `leads`, `lead_columns`, `lead_tags`, `lead_tag_assignments`.

## Server functions (TanStack `createServerFn`, todas com `requireSupabaseAuth`)

- `geocodeCity({ country, state, city })` → bbox via Nominatim (com User-Agent obrigatório e cache em memória).
- `searchLeadsOSM({ bbox, niche, name? })` → query Overpass, normaliza pra shape unificado.
- `searchLeadsGoogle({ query, location, radius })` → só roda se a chave existir; combina Text Search + Place Details em paralelo.
- `enrichEmails({ leads })` → pra cada lead com `website`, consulta cache; se vazio, chama Firecrawl `scrape` na home + tenta `/contato`; salva no cache.
- `saveLead({ leadData })`, `updateLead`, `deleteLead`, `moveLead({ id, columnId, position })`.
- `listColumns/createColumn/renameColumn/deleteColumn/reorderColumns`.
- `listTags/createTag/deleteTag/assignTag/removeTag`.

Endpoints externos (Nominatim, Overpass, Google, Firecrawl) chamados **só do servidor** pra não vazar chave nem sofrer CORS.

## UI

**`/leads/extrair`**
- Form: país (select default Brasil), estado, cidade, nicho (combo com sugestões: "restaurante", "barbearia", "academia", "petshop"...), nome opcional, toggle "Buscar emails nos sites" (default on), toggle "Usar Google Places" (só aparece se chave configurada).
- Resultados em grid de cards: foto (placeholder se não tem), nome, ⭐ rating, telefone clicável (tel:), email clicável (mailto:), endereço (link Maps), site, descrição, badge da fonte (OSM/Google), botão **Salvar lead** (move o card pra coluna "Novo" do kanban com feedback visual).
- Progresso de enriquecimento de email mostrado por card ("buscando email...").

**`/leads`** (kanban)
- Colunas horizontais com scroll. Header de cada coluna: nome editável inline, contador, menu (renomear, mudar cor, excluir).
- Cards arrastáveis (`@dnd-kit/core` — já é padrão e leve). Drop entre colunas e reordenação dentro da coluna persistem via `moveLead`.
- Card mostra: foto/iniciais, nome, telefone, email, etiquetas coloridas, ações (abrir detalhe, excluir).
- Modal de detalhe: editar todos os campos, anotações livres, gerenciar etiquetas (criar nova com nome+cor ou escolher das existentes), histórico de mudança de coluna.
- Botão "+ Lead manual" abre o mesmo modal vazio.
- Botão "+ Coluna" no fim do board.
- Realtime: `supabase.channel` em `leads` + `lead_columns` + `lead_tag_assignments` reflete mudanças sem reload.

**Dashboard**: card de atalho "Leads" (igual ao da Agenda), só aparece se o plano permite.

**Admin → Personalização**: nova seção "Leads" com multi-select de planos permitidos + campo opcional "Google Places API Key" (mascarado).

## Limites e expectativas

- OSM cobre bem categorias amplas em cidades médias/grandes; vilarejos têm pouca coisa cadastrada. Telefone vem em ~30-50% dos POIs no Brasil, email quase nunca.
- Email scraping acerta quando o site tem `mailto:` ou contato textual; não tenta formulários nem captchas.
- Overpass API tem rate limit público — implementamos retry com backoff e limite de 200 resultados por busca.
- Firecrawl: usamos o plano gratuito do conector. Se estourar créditos, mostramos aviso e seguimos sem email.
- Google Places: chave é opcional; sem ela, tudo funciona.

## Arquivos

**Novos**
- `supabase/migrations/<ts>_leads_crm.sql`
- `src/lib/leads.functions.ts`, `src/lib/geocode.functions.ts`, `src/lib/email-scrape.functions.ts`
- `src/routes/leads.tsx` (kanban), `src/routes/leads.extrair.tsx`
- `src/components/Leads/LeadCard.tsx`, `KanbanColumn.tsx`, `LeadDetailModal.tsx`, `TagManager.tsx`, `ExtractForm.tsx`, `ResultCard.tsx`

**Editados**
- `src/routes/dashboard.tsx` (card de atalho)
- `src/routes/acsadmin.tsx` (seção Leads + chave Google)

**Deps novas**: `@dnd-kit/core`, `@dnd-kit/sortable` (kanban). Firecrawl já vai ser conectado.

## Dependência externa que precisa de aprovação

Pra o scraping de email funcionar, vou pedir a conexão do **Firecrawl** (conector nativo do Lovable, sem chave manual sua) na hora de implementar. Sem ele, todo resto funciona; só não busca email automático.