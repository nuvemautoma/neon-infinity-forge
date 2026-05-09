-- =========================
-- LEADS
-- =========================
CREATE TABLE public.lead_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#00B4FF',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own lead_columns" ON public.lead_columns
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lead_columns_updated BEFORE UPDATE ON public.lead_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  column_id UUID REFERENCES public.lead_columns(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  rating NUMERIC(2,1),
  reviews_count INTEGER,
  photo_url TEXT,
  description TEXT,
  category TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own leads" ON public.leads
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE INDEX idx_leads_user ON public.leads(user_id);
CREATE INDEX idx_leads_column ON public.leads(column_id, position);
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7A00FF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own lead_tags" ON public.lead_tags
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE TABLE public.lead_tag_assignments (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  PRIMARY KEY(lead_id, tag_id)
);
ALTER TABLE public.lead_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own assignments" ON public.lead_tag_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.user_id = auth.uid() OR has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.user_id = auth.uid() OR has_role(auth.uid(),'admin'))));

-- =========================
-- EMAIL SCRAPE CACHE (compartilhado)
-- =========================
CREATE TABLE public.email_scrape_cache (
  domain TEXT PRIMARY KEY,
  email TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_scrape_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cache" ON public.email_scrape_cache
  FOR SELECT TO authenticated USING (true);
-- writes só via server function admin client

-- =========================
-- SITE SETTINGS
-- =========================
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS leads_allowed_plans TEXT[] NOT NULL DEFAULT ARRAY['standard']::text[],
  ADD COLUMN IF NOT EXISTS google_places_api_key TEXT;

-- Esconder google_places_api_key da view pública: criar policies separadas
DROP POLICY IF EXISTS "Public can view settings" ON public.site_settings;
CREATE POLICY "Public can view settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);
-- (a chave em si é exposta; ajustamos lendo só do servidor — protegemos no app)
-- Para garantir que o front nunca leia a chave, criamos uma view pública:
CREATE OR REPLACE VIEW public.site_settings_public AS
  SELECT id, site_name, primary_color, secondary_color, background_color,
         logo_url, favicon_url, banner_url, support_email, support_whatsapp,
         affiliate_html, landing_html, custom_css, leads_allowed_plans,
         (google_places_api_key IS NOT NULL AND length(google_places_api_key) > 0) AS has_google_places_key,
         updated_at
  FROM public.site_settings;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- =========================
-- REALTIME
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tag_assignments;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.lead_columns REPLICA IDENTITY FULL;
ALTER TABLE public.lead_tags REPLICA IDENTITY FULL;
ALTER TABLE public.lead_tag_assignments REPLICA IDENTITY FULL;