CREATE TABLE public.official_coins (
  id text PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  tx_hash text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.official_coins TO service_role;
ALTER TABLE public.official_coins ENABLE ROW LEVEL SECURITY;