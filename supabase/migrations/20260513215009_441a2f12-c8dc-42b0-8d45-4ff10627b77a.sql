-- 1. Capacidade do pool por conta
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS shared_capacity integer NOT NULL DEFAULT 4;

-- 2. Tabela de entregas (vários usuários por mesmo stock item)
CREATE TABLE IF NOT EXISTS public.account_stock_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id uuid NOT NULL REFERENCES public.account_stock_items(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_email text,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stock_item_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_asd_account ON public.account_stock_deliveries(account_id);
CREATE INDEX IF NOT EXISTS idx_asd_user ON public.account_stock_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_asd_item ON public.account_stock_deliveries(stock_item_id);

ALTER TABLE public.account_stock_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage deliveries" ON public.account_stock_deliveries;
CREATE POLICY "Admins manage deliveries" ON public.account_stock_deliveries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own deliveries" ON public.account_stock_deliveries;
CREATE POLICY "Users view own deliveries" ON public.account_stock_deliveries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. RPC: claim_pool_account (pool com capacidade)
CREATE OR REPLACE FUNCTION public.claim_pool_account(_account_id uuid)
RETURNS TABLE(content text, label text, item_id uuid, exhausted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_account record;
  v_user_plan text;
  v_existing record;
  v_item record;
  v_capacity integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT email, plan INTO v_email, v_user_plan FROM public.profiles WHERE id = v_user;
  SELECT * INTO v_account FROM public.accounts WHERE id = _account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;
  IF NOT (v_user_plan = ANY(v_account.allowed_plans)) THEN RAISE EXCEPTION 'plan not allowed'; END IF;

  v_capacity := GREATEST(COALESCE(v_account.shared_capacity, 4), 1);

  -- Já tem entrega válida (item não marcado e dentro da rotação)?
  SELECT s.id, s.content, s.label
    INTO v_existing
    FROM public.account_stock_deliveries d
    JOIN public.account_stock_items s ON s.id = d.stock_item_id
   WHERE d.user_id = v_user
     AND s.account_id = _account_id
     AND s.marked_bad = false
     AND (d.delivered_at + (v_account.rotation_days || ' days')::interval) > now()
   ORDER BY d.delivered_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.content, v_existing.label, v_existing.id, false; RETURN;
  END IF;

  -- Próximo item válido com vagas (capacity)
  SELECT s.* INTO v_item
    FROM public.account_stock_items s
   WHERE s.account_id = _account_id
     AND s.marked_bad = false
     AND (
       SELECT COUNT(*) FROM public.account_stock_deliveries d2
        WHERE d2.stock_item_id = s.id
     ) < v_capacity
   ORDER BY s.position ASC, s.created_at ASC
   LIMIT 1
   FOR UPDATE OF s SKIP LOCKED;

  IF NOT FOUND THEN
    INSERT INTO public.account_issue_reports (user_id, user_email, account_id, account_name, reason)
    VALUES (v_user, v_email, _account_id, v_account.name, 'sem_estoque')
    ON CONFLICT DO NOTHING;
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::uuid, true; RETURN;
  END IF;

  INSERT INTO public.account_stock_deliveries (stock_item_id, account_id, user_id, user_email)
  VALUES (v_item.id, _account_id, v_user, v_email)
  ON CONFLICT (stock_item_id, user_id) DO NOTHING;

  -- mantém compat: marca como entregue (primeiro destinatário)
  UPDATE public.account_stock_items
     SET is_used = true,
         delivered_at = COALESCE(delivered_at, now()),
         delivered_to = COALESCE(delivered_to, v_user),
         delivered_to_email = COALESCE(delivered_to_email, v_email)
   WHERE id = v_item.id;

  RETURN QUERY SELECT v_item.content, v_item.label, v_item.id, false;
END $$;

-- 4. Atualiza report_account_issue para suportar 'pool'
CREATE OR REPLACE FUNCTION public.report_account_issue(_stock_item_id uuid, _reason text)
RETURNS TABLE(new_content text, new_label text, new_item_id uuid, escalated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_item record;
  v_account record;
  v_next record;
  v_owns boolean;
  v_capacity integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_item FROM public.account_stock_items WHERE id = _stock_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  SELECT * INTO v_account FROM public.accounts WHERE id = v_item.account_id;

  -- valida posse: shared (delivered_to) OU pool (linha em deliveries)
  v_owns := (v_item.delivered_to = v_user);
  IF NOT v_owns THEN
    SELECT EXISTS(SELECT 1 FROM public.account_stock_deliveries
                   WHERE stock_item_id = _stock_item_id AND user_id = v_user) INTO v_owns;
  END IF;
  IF NOT v_owns THEN RAISE EXCEPTION 'not your item'; END IF;

  UPDATE public.account_stock_items
    SET marked_bad = true, marked_bad_at = now(), marked_bad_reason = _reason
    WHERE id = _stock_item_id;

  -- POOL: tenta próximo item com vagas
  IF v_account.delivery_type = 'pool' THEN
    v_capacity := GREATEST(COALESCE(v_account.shared_capacity, 4), 1);
    SELECT s.* INTO v_next
      FROM public.account_stock_items s
     WHERE s.account_id = v_account.id
       AND s.marked_bad = false
       AND (SELECT COUNT(*) FROM public.account_stock_deliveries d2 WHERE d2.stock_item_id = s.id) < v_capacity
     ORDER BY s.position ASC, s.created_at ASC LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
    IF FOUND THEN
      INSERT INTO public.account_stock_deliveries (stock_item_id, account_id, user_id, user_email)
      VALUES (v_next.id, v_account.id, v_user, v_email)
      ON CONFLICT (stock_item_id, user_id) DO NOTHING;
      UPDATE public.account_stock_items
         SET is_used = true,
             delivered_at = COALESCE(delivered_at, now()),
             delivered_to = COALESCE(delivered_to, v_user),
             delivered_to_email = COALESCE(delivered_to_email, v_email)
       WHERE id = v_next.id;
      INSERT INTO public.account_issue_reports (user_id, user_email, account_id, account_name, stock_item_id, reason, status)
      VALUES (v_user, v_email, v_account.id, v_account.name, _stock_item_id, _reason, 'auto_rotated');
      RETURN QUERY SELECT v_next.content, v_next.label, v_next.id, false; RETURN;
    END IF;
  -- SHARED original
  ELSIF v_account.delivery_type = 'shared' THEN
    SELECT * INTO v_next FROM public.account_stock_items
     WHERE account_id = v_account.id AND delivered_to IS NULL AND marked_bad = false
     ORDER BY position ASC, created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF FOUND THEN
      UPDATE public.account_stock_items
        SET delivered_to = v_user, delivered_to_email = v_email, delivered_at = now(), is_used = true
        WHERE id = v_next.id;
      INSERT INTO public.account_issue_reports (user_id, user_email, account_id, account_name, stock_item_id, reason, status)
      VALUES (v_user, v_email, v_account.id, v_account.name, _stock_item_id, _reason, 'auto_rotated');
      RETURN QUERY SELECT v_next.content, v_next.label, v_next.id, false; RETURN;
    END IF;
  END IF;

  -- Sem estoque para rotacionar -> escala para admin (reposição)
  INSERT INTO public.account_issue_reports (user_id, user_email, account_id, account_name, stock_item_id, reason)
  VALUES (v_user, v_email, v_account.id, v_account.name, _stock_item_id, _reason);
  RETURN QUERY SELECT NULL::text, NULL::text, NULL::uuid, true;
END $$;