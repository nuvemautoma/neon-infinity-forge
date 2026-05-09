
CREATE OR REPLACE FUNCTION public.claim_stock_item(_account_id uuid)
RETURNS TABLE(content text, already_had boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_email text;
  v_account record;
  v_existing record;
  v_item record;
  v_user_plan text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT email, plan INTO v_user_email, v_user_plan FROM public.profiles WHERE id = v_user;

  SELECT * INTO v_account FROM public.accounts WHERE id = _account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;

  IF NOT (v_user_plan = ANY(v_account.allowed_plans)) THEN
    RAISE EXCEPTION 'plan not allowed';
  END IF;

  -- Compartilhado: nada a entregar
  IF v_account.delivery_type = 'shared' THEN
    RETURN QUERY SELECT NULL::text, false;
    RETURN;
  END IF;

  -- Individual: já recebeu?
  SELECT * INTO v_existing FROM public.account_stock_items
    WHERE account_id = _account_id AND delivered_to = v_user LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.content, true;
    RETURN;
  END IF;

  -- Reservar próximo disponível
  SELECT * INTO v_item FROM public.account_stock_items
    WHERE account_id = _account_id AND delivered_to IS NULL
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, false;
    RETURN;
  END IF;

  UPDATE public.account_stock_items
    SET delivered_to = v_user, delivered_to_email = v_user_email,
        delivered_at = now(), is_used = true
    WHERE id = v_item.id;

  RETURN QUERY SELECT v_item.content, false;
END $$;

REVOKE ALL ON FUNCTION public.claim_stock_item(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_stock_item(uuid) TO authenticated;

-- Função para resolver solicitação (admin) - notifica e deleta
CREATE OR REPLACE FUNCTION public.resolve_support_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_req FROM public.support_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, title, message)
  VALUES (
    v_req.user_id,
    'Solicitação resolvida',
    'Sua solicitação do produto ' || COALESCE(v_req.account_name, 'desconhecido') ||
    ' foi resolvida em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.'
  );

  DELETE FROM public.support_requests WHERE id = _request_id;
END $$;

REVOKE ALL ON FUNCTION public.resolve_support_request(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_support_request(uuid) TO authenticated;

-- Broadcast notificação para todos ou por plano
CREATE OR REPLACE FUNCTION public.broadcast_notification(_title text, _message text, _plan text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.notifications (user_id, title, message)
  SELECT id, _title, _message FROM public.profiles
  WHERE _plan IS NULL OR plan = _plan;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.broadcast_notification(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(text, text, text) TO authenticated;

-- Limpar todos estoques (mantém produtos)
CREATE OR REPLACE FUNCTION public.admin_clear_all_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.account_stock_items;
END $$;
REVOKE ALL ON FUNCTION public.admin_clear_all_stock() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_all_stock() TO authenticated;

-- Deletar todos produtos
CREATE OR REPLACE FUNCTION public.admin_delete_all_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.accounts;
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_all_accounts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_accounts() TO authenticated;
