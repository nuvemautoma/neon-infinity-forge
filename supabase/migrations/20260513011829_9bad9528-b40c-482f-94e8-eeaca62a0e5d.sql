
-- 1. Suppliers table
CREATE TABLE public.account_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  supplier_name text NOT NULL,
  supplier_url text,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage suppliers" ON public.account_suppliers
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.account_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Alter accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS rotation_days integer NOT NULL DEFAULT 30;

-- 3. Alter stock items
ALTER TABLE public.account_stock_items
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marked_bad boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marked_bad_at timestamptz,
  ADD COLUMN IF NOT EXISTS marked_bad_reason text,
  ADD COLUMN IF NOT EXISTS manually_assigned boolean NOT NULL DEFAULT false;

-- 4. Issue reports
CREATE TABLE public.account_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  account_id uuid NOT NULL,
  account_name text,
  stock_item_id uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_issue_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage issue reports" ON public.account_issue_reports
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own issue reports" ON public.account_issue_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own issue reports" ON public.account_issue_reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 5. claim_shared_account RPC (rotação)
CREATE OR REPLACE FUNCTION public.claim_shared_account(_account_id uuid)
RETURNS TABLE(content text, label text, item_id uuid, exhausted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_account record;
  v_user_plan text;
  v_existing record;
  v_item record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT email, plan INTO v_email, v_user_plan FROM public.profiles WHERE id = v_user;
  SELECT * INTO v_account FROM public.accounts WHERE id = _account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;
  IF NOT (v_user_plan = ANY(v_account.allowed_plans)) THEN RAISE EXCEPTION 'plan not allowed'; END IF;

  -- já tem item válido (não marcado e dentro da janela de rotação)?
  SELECT * INTO v_existing FROM public.account_stock_items
   WHERE account_id = _account_id AND delivered_to = v_user
     AND marked_bad = false
     AND (delivered_at + (v_account.rotation_days || ' days')::interval) > now()
   ORDER BY delivered_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.content, v_existing.label, v_existing.id, false; RETURN;
  END IF;

  -- próximo item livre, não marcado, em ordem de position
  SELECT * INTO v_item FROM public.account_stock_items
   WHERE account_id = _account_id AND delivered_to IS NULL AND marked_bad = false
   ORDER BY position ASC, created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN
    INSERT INTO public.account_issue_reports (user_id, user_email, account_id, account_name, reason)
    VALUES (v_user, v_email, _account_id, v_account.name, 'sem_estoque')
    ON CONFLICT DO NOTHING;
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::uuid, true; RETURN;
  END IF;

  UPDATE public.account_stock_items
    SET delivered_to = v_user, delivered_to_email = v_email, delivered_at = now(), is_used = true
    WHERE id = v_item.id;
  RETURN QUERY SELECT v_item.content, v_item.label, v_item.id, false;
END $$;

-- 6. report_account_issue RPC
CREATE OR REPLACE FUNCTION public.report_account_issue(_stock_item_id uuid, _reason text)
RETURNS TABLE(new_content text, new_label text, new_item_id uuid, escalated boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_item record;
  v_account record;
  v_next record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_item FROM public.account_stock_items WHERE id = _stock_item_id;
  IF NOT FOUND OR v_item.delivered_to <> v_user THEN RAISE EXCEPTION 'not your item'; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  SELECT * INTO v_account FROM public.accounts WHERE id = v_item.account_id;

  UPDATE public.account_stock_items
    SET marked_bad = true, marked_bad_at = now(), marked_bad_reason = _reason
    WHERE id = _stock_item_id;

  -- tenta próximo apenas para shared
  IF v_account.delivery_type = 'shared' THEN
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

  INSERT INTO public.account_issue_reports (user_id, user_email, account_id, account_name, stock_item_id, reason)
  VALUES (v_user, v_email, v_account.id, v_account.name, _stock_item_id, _reason);
  RETURN QUERY SELECT NULL::text, NULL::text, NULL::uuid, true;
END $$;

-- 7. admin_assign_stock_to_user
CREATE OR REPLACE FUNCTION public.admin_assign_stock_to_user(_account_id uuid, _user_id uuid, _content text, _label text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.account_stock_items (account_id, content, label, delivered_to, delivered_to_email, delivered_at, is_used, manually_assigned)
  VALUES (_account_id, _content, _label, _user_id, v_email, now(), true, true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 8. admin_resolve_issue_report
CREATE OR REPLACE FUNCTION public.admin_resolve_issue_report(_report_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.account_issue_reports
    SET status = 'resolved', resolved_at = now(), admin_notes = COALESCE(_notes, admin_notes)
    WHERE id = _report_id;
END $$;
