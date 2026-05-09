ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS landing_html text;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;