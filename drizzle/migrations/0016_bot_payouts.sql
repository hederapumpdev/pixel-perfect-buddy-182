CREATE TABLE public.bot_payouts (
  id text PRIMARY KEY,
  kind text NOT NULL,
  recipient text NOT NULL,
  token text,
  hbar_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_payouts TO anon, authenticated;
GRANT ALL ON public.bot_payouts TO service_role;
ALTER TABLE public.bot_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts readable" ON public.bot_payouts FOR SELECT TO anon, authenticated USING (true);