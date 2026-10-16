CREATE TABLE public.x_daily_media (slot text PRIMARY KEY, media_id text NOT NULL, expires_at timestamptz NOT NULL);
GRANT ALL ON public.x_daily_media TO service_role;
ALTER TABLE public.x_daily_media ENABLE ROW LEVEL SECURITY;