
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'account';
ALTER TABLE public.accounts ADD CONSTRAINT accounts_kind_check CHECK (kind IN ('account','tool'));
CREATE INDEX IF NOT EXISTS idx_accounts_kind ON public.accounts(kind);

CREATE TABLE IF NOT EXISTS public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  time_of_day time NOT NULL,
  days_of_week int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  repeat_count int NOT NULL DEFAULT 1,
  notify_enabled boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own agenda" ON public.agenda_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own subs" ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.agenda_sent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, scheduled_for)
);
ALTER TABLE public.agenda_sent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads sent log" ON public.agenda_sent_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
