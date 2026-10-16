CREATE TABLE public.bot_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  usd_amount numeric NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_settings TO anon, authenticated;
GRANT ALL ON public.bot_settings TO service_role;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bot settings are public" ON public.bot_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.bot_settings (id, enabled, usd_amount) VALUES (1, true, 2);