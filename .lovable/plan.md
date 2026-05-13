# Plano: Organização Admin + Rotação de Contas

## 1. Banco de dados (migration)

**Nova tabela `account_suppliers`** (links de fornecedor + custo por produto):
- `account_id` (fk accounts), `supplier_name`, `supplier_url`, `unit_cost` (numeric), `quantity`, `notes`

**Alterar `account_stock_items`** (já existe, é o que vira "Conta 1, Conta 2..."):
- adicionar `label` (text) — ex: "Conta 1"
- adicionar `position` (int) — ordem de entrega
- adicionar `marked_bad` (bool) + `marked_bad_at` + `marked_bad_reason`
- adicionar `manually_assigned` (bool) — se admin entregou manual, não reentrega

**Alterar `accounts`**:
- adicionar `rotation_days` (int default 30) — após X dias, próximo acesso

**Nova tabela `account_issue_reports`** (substitui aglomeração nas notifications):
- `user_id`, `account_id`, `stock_item_id`, `reason` (login_invalido | sem_creditos | outro), `status` (pending | resolved), `admin_notes`, `created_at`

## 2. Lógica de entrega (atualiza `claim_stock_item` RPC)

Para `delivery_type = 'individual'` (Canva-like = 1 por usuário):
- mantém comportamento atual; se sem estoque → cria `account_issue_reports` com motivo `sem_estoque`
- admin pode anexar link manual ao usuário via novo RPC `admin_assign_stock_to_user` → marca `manually_assigned=true`. Reposição futura ignora esse usuário.

Para `delivery_type = 'shared'` (rotativa Conta 1, 2, 3):
- nova RPC `claim_shared_account(_account_id)`:
  - busca último item entregue ao user; se < `rotation_days` E não `marked_bad` → retorna mesmo
  - senão pega próximo `position` disponível e não `marked_bad`
  - se acabar → cria `account_issue_reports` com motivo `sem_estoque`

Nova RPC `report_account_issue(_stock_item_id, _reason)`:
- marca item como `marked_bad`
- se houver próximo na rotação → entrega automaticamente e retorna
- se não houver → cria `account_issue_reports` para admin

## 3. UI Admin — `/acsadmin` ganha aba "Organização"

Componente `AdminOrganization`:
- **Tab Fornecedores**: tabela por produto com supplier_url, unit_cost, quantidade, total. Soma geral "Total gasto".
- **Tab Solicitações**: lista `account_issue_reports` pendentes. Para cada: ferramenta, usuário, motivo, ação ("Resolver" / "Anexar acesso manual").
- **Editor de produto**: ao criar/editar conta, novo bloco "Acessos (Conta 1, 2, 3...)" — adiciona N stock_items com label e position. Campo `rotation_days`.

## 4. UI Usuário

No modal de detalhe da conta (`AccountDetailModal`):
- botão "Reportar problema" → abre dialog com motivos (login inválido / créditos esgotados / outro) → chama `report_account_issue` → se rotação trouxe nova conta, mostra; senão "Solicitação enviada ao admin".

## 5. Arquivos afetados

- `supabase/migrations/...` — schema + RPCs
- `src/routes/acsadmin.tsx` — adicionar aba Organização
- `src/components/AdminOrganization.tsx` (novo)
- `src/components/AccountDetailModal.tsx` — botão reportar
- `src/components/ReportIssueDialog.tsx` (novo)

## Detalhes técnicos
- RLS: `account_suppliers` e `account_issue_reports` somente admin (exceto INSERT em reports pelo próprio user).
- `claim_shared_account` é SECURITY DEFINER, retorna `{content, label, item_id}`.
- Frontend usa `supabase.rpc(...)` para todas as ações.
- Notifications continuam só para "resolvido" e mensagens broadcast — issues vão para tabela própria.