ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS block_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS block_event text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS block_amount numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_at timestamptz;