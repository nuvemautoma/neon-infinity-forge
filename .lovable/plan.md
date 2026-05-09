## Plano de Implementação — Sistema Completo de Estoque, Notificações e Planos

### 1. Banco de Dados (Migração)

**Modificações em `accounts`:**
- `delivery_type`: `'shared'` (acesso compartilhado, estoque ilimitado opcional) ou `'individual'` (1 link/conta por usuário)
- `unlimited_stock`: boolean (só permitido se `shared`)
- `stock_items`: separado em nova tabela
- `allowed_plans`: text[] (`['plus', 'standard']`) — quais planos têm acesso

**Nova tabela `account_stock_items`:**
- `account_id`, `content` (link/credencial), `delivered_to` (user_id), `delivered_at`, `is_used`

**Nova tabela `user_deliveries`:**
- `user_id`, `account_id`, `stock_item_id`, `delivered_at` — histórico do que cada usuário recebeu

**Nova tabela `support_requests`:**
- `user_id`, `account_id`, `message` (max 900), `status` (`open`/`resolved`), `resolved_at`

**Nova tabela `notifications`:**
- `user_id`, `title`, `message`, `read`, `created_at`

**`profiles`:** adicionar `plan` já existe (basic) — mudar default e aceitar `'plus'`/`'standard'`/`'basic'`

**Trigger:** quando admin cria stock_item para conta `individual`, sistema entrega automaticamente para usuários elegíveis sem entrega ainda.

**Usuário admin:** criar via Supabase Auth + atribuir role admin (`infinityias@adm.com` / `infinity84`).

### 2. Backend / Server Functions

- `request_support` — usuário envia solicitação (validação 900 chars)
- `resolve_support_request` — admin marca como resolvido → cria notificação + deleta solicitação
- `add_stock_bulk` — admin adiciona links em massa (split por `;`)
- `deliver_stock` — entrega item individual ao acessar
- `delete_all_products` — com 2 confirmações
- `clear_all_stock` — limpa stock_items mas mantém produtos
- `add_stock_to_all` — exceto individuais
- `send_notification_broadcast` — admin envia para todos ou plano
- Webhook Cakto atualizado: aceita `plan: 'plus' | 'standard'`

### 3. Frontend — Área de Membros (`/dashboard`)

- **Sininho** notificações no header (badge contador, dropdown com lista, marcar como lida)
- **Modal de produto:** botão "Erros ou link cheio? Solicite aqui" → textarea 900 chars
- **Produtos individuais:** mostra "Seu acesso exclusivo" com link/conta entregue
- **Produtos compartilhados:** mostra credenciais comuns
- Filtro por plano do usuário

### 4. Frontend — Painel Admin (`/acsadmin`)

Novas abas:
- **Estoque:** lista produtos com nível, badge de baixo/zerado, ações (adicionar, limpar, infinito)
- **Solicitações:** lista de support_requests, botão "Marcar como resolvido"
- **Urgência:** dashboard de produtos com estoque baixo/zero (não-infinito)
- **Notificações:** form para enviar notificação para todos / por plano
- **Planos:** configurar quais produtos cada plano (plus/standard) acessa
- **Produto (form):** campos novos — `delivery_type`, `unlimited_stock`, `allowed_plans`, textarea bulk de links separados por `;`
- **Ações perigosas:** "Deletar todos produtos" (2 confirmações), "Limpar todos estoques", "Adicionar estoque a todos"

### 5. Realtime
- Notificações em tempo real (canal por user_id)
- Estoque atualizando no admin

---

### Detalhes técnicos
- Validação Zod no servidor (900 chars, planos enum)
- RLS: usuários veem apenas suas notificações/entregas/solicitações; admin vê tudo
- Webhook: campo `plan` mapeia para `plus`/`standard`/`basic`
- Bug atual `framer-motion` em dashboard — corrigir importação

### Escopo
Mudança grande mas focada. Vou implementar tudo de uma vez nesta loop, começando pela migração do banco.