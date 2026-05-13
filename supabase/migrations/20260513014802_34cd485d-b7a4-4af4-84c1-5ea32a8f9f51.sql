ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_refresh ON public.leads (last_refreshed_at NULLS FIRST) WHERE website IS NOT NULL;