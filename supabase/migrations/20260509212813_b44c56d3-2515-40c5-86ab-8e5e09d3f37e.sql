DROP TABLE IF EXISTS public.cloned_pages;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS cloner_allowed_plans;