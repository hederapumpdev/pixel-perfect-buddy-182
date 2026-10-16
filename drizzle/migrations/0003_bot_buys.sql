CREATE TABLE public.bot_buys (
  token text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  hbar_amount numeric NOT NULL DEFAULT 0,
  tx_hash text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_buys TO anon, authenticated;
GRANT ALL ON public.bot_buys TO service_role;
ALTER TABLE public.bot_buys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bot buys are public on-chain activity" ON public.bot_buys FOR SELECT TO anon, authenticated USING (true);