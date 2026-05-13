-- Migrate plans: basic→plus, standard→enterprise; only plus and enterprise remain
UPDATE public.profiles SET plan = 'plus' WHERE plan = 'basic';
UPDATE public.profiles SET plan = 'enterprise' WHERE plan = 'standard';
ALTER TABLE public.profiles ALTER COLUMN plan SET DEFAULT 'plus';

-- Update accounts.allowed_plans arrays
UPDATE public.accounts
SET allowed_plans = (
  SELECT ARRAY(SELECT DISTINCT CASE WHEN p = 'basic' THEN 'plus' WHEN p = 'standard' THEN 'enterprise' ELSE p END FROM unnest(allowed_plans) AS p)
);
ALTER TABLE public.accounts ALTER COLUMN allowed_plans SET DEFAULT ARRAY['plus','enterprise'];

-- Update site_settings.leads_allowed_plans
UPDATE public.site_settings
SET leads_allowed_plans = (
  SELECT ARRAY(SELECT DISTINCT CASE WHEN p = 'basic' THEN 'plus' WHEN p = 'standard' THEN 'enterprise' ELSE p END FROM unnest(leads_allowed_plans) AS p)
);
ALTER TABLE public.site_settings ALTER COLUMN leads_allowed_plans SET DEFAULT ARRAY['plus','enterprise'];

-- Daily extraction usage log
CREATE TABLE IF NOT EXISTS public.lead_extraction_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  used_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_extraction_usage_user_day ON public.lead_extraction_usage(user_id, used_on);
ALTER TABLE public.lead_extraction_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own usage" ON public.lead_extraction_usage FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RPC to consume one quota; raises if exceeded
CREATE OR REPLACE FUNCTION public.consume_extraction_quota()
RETURNS TABLE(used integer, daily_limit integer, plan text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan text;
  v_limit integer;
  v_used integer;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT p.plan INTO v_plan FROM public.profiles p WHERE p.id = v_user;
  v_plan := COALESCE(v_plan, 'plus');
  v_limit := CASE WHEN v_plan = 'enterprise' THEN 17 WHEN v_plan = 'plus' THEN 6 ELSE 0 END;
  SELECT COUNT(*)::int INTO v_used FROM public.lead_extraction_usage
   WHERE user_id = v_user AND used_on = v_today;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Limite diário de extrações atingido (% de %).', v_used, v_limit USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.lead_extraction_usage (user_id) VALUES (v_user);
  RETURN QUERY SELECT (v_used + 1), v_limit, v_plan;
END $$;