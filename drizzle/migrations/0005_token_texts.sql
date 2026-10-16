CREATE TABLE public.token_texts (hash text PRIMARY KEY, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.token_texts TO anon, authenticated;
GRANT ALL ON public.token_texts TO service_role;
ALTER TABLE public.token_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read texts" ON public.token_texts FOR SELECT TO anon, authenticated USING (true);