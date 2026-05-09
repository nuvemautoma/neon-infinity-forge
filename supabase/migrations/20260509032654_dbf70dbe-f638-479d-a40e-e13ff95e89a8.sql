
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS support_whatsapp text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS purchase_date date;
