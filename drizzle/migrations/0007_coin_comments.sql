CREATE TABLE public.coin_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  author text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coin_comments_token_idx ON public.coin_comments (token, created_at DESC);
GRANT SELECT ON public.coin_comments TO anon, authenticated;
GRANT ALL ON public.coin_comments TO service_role;
ALTER TABLE public.coin_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are public" ON public.coin_comments FOR SELECT TO anon, authenticated USING (true);