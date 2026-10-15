CREATE TABLE public.tokens (
  address text PRIMARY KEY,
  network text NOT NULL,
  creator text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  description text,
  image_url text,
  website text,
  twitter text,
  telegram text,
  virtual_hbar numeric NOT NULL DEFAULT 0,
  virtual_tokens numeric NOT NULL DEFAULT 0,
  tokens_sold numeric NOT NULL DEFAULT 0,
  volume_hbar numeric NOT NULL DEFAULT 0,
  trade_count integer NOT NULL DEFAULT 0,
  graduated boolean NOT NULL DEFAULT false,
  created_tx text,
  created_at timestamptz NOT NULL,
  last_trade_at timestamptz
);
GRANT SELECT ON public.tokens TO anon, authenticated;
GRANT ALL ON public.tokens TO service_role;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens readable" ON public.tokens FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.trades (
  id text PRIMARY KEY,
  network text NOT NULL,
  token text NOT NULL REFERENCES public.tokens(address) ON DELETE CASCADE,
  trader text NOT NULL,
  is_buy boolean NOT NULL,
  hbar_amount numeric NOT NULL,
  token_amount numeric NOT NULL,
  fee numeric NOT NULL,
  price numeric NOT NULL,
  tx_hash text,
  created_at timestamptz NOT NULL
);
CREATE INDEX trades_token_time ON public.trades(token, created_at DESC);
GRANT SELECT ON public.trades TO anon, authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades readable" ON public.trades FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.sync_state (
  contract text PRIMARY KEY,
  last_timestamp text NOT NULL DEFAULT '0',
  synced_at timestamptz NOT NULL DEFAULT 'epoch'
);
GRANT ALL ON public.sync_state TO service_role;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens;