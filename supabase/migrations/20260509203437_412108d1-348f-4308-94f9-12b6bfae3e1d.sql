CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.cloned_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_url TEXT,
  editor_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cloned_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cloned pages"
  ON public.cloned_pages
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cloned_pages_user ON public.cloned_pages(user_id);

CREATE TRIGGER update_cloned_pages_updated_at
  BEFORE UPDATE ON public.cloned_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS cloner_allowed_plans TEXT[] NOT NULL DEFAULT ARRAY['standard']::text[];
