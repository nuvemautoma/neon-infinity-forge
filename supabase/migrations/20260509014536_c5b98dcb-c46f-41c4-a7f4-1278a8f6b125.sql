
-- 1. Modificações em accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS unlimited_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_plans text[] NOT NULL DEFAULT ARRAY['basic','plus','standard']::text[];

-- 2. Tabela de itens de estoque
CREATE TABLE IF NOT EXISTS public.account_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  content text NOT NULL,
  delivered_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delivered_to_email text,
  delivered_at timestamptz,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_account ON public.account_stock_items(account_id);
CREATE INDEX IF NOT EXISTS idx_stock_delivered ON public.account_stock_items(delivered_to);

ALTER TABLE public.account_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage stock" ON public.account_stock_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view their delivered stock" ON public.account_stock_items
  FOR SELECT TO authenticated USING (delivered_to = auth.uid());

-- 3. Solicitações de suporte
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  account_name text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT support_message_length CHECK (char_length(message) <= 900 AND char_length(message) > 0)
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own requests" ON public.support_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own requests" ON public.support_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage requests" ON public.support_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 4. Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests;

-- 6. Criar usuário admin
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'infinityias@adm.com';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'infinityias@adm.com',
      crypt('infinity84', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin Infinity"}'::jsonb,
      'authenticated', 'authenticated', '', '', '', ''
    );
    
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', 'infinityias@adm.com'), 'email', v_user_id::text, now(), now(), now());
  END IF;

  -- garantir profile + role admin
  INSERT INTO public.profiles (id, email, full_name, plan, status)
  VALUES (v_user_id, 'infinityias@adm.com', 'Admin Infinity', 'plus', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
