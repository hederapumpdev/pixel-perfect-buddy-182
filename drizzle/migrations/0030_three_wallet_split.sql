-- Three-wallet fee split + Hold Out rewards.
-- Split wallet receives the 70% platform share and forwards: 2/7 team, 1/7 Hold Out, 4/7 platform.
-- wallet_payouts is the ledger for every automatic payout from the three new wallets.

ALTER TABLE public.bot_payouts ADD COLUMN IF NOT EXISTS sender text NOT NULL DEFAULT '';

CREATE TABLE public.platform_wallets (
  kind text PRIMARY KEY CHECK (kind IN ('split', 'team', 'holdout')),
  evm text NOT NULL,
  account_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz
);
GRANT SELECT ON public.platform_wallets TO anon, authenticated;
GRANT ALL ON public.platform_wallets TO service_role;
ALTER TABLE public.platform_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_wallets readable" ON public.platform_wallets FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.wallet_payouts (
  id text PRIMARY KEY,
  kind text NOT NULL, -- ensure | split | staff | holdout
  sender text NOT NULL,
  recipient text NOT NULL,
  token text NOT NULL DEFAULT '',
  hbar_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'done', 'failed', 'unknown', 'skipped')),
  tx_hash text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_payouts TO anon, authenticated;
GRANT ALL ON public.wallet_payouts TO service_role;
ALTER TABLE public.wallet_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_payouts readable" ON public.wallet_payouts FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX wallet_payouts_recent ON public.wallet_payouts (created_at DESC, id DESC);

-- Latest holder snapshot per coin: balance, holding age and Hold Out weight per wallet.
CREATE TABLE public.holdout_snapshots (
  token text PRIMARY KEY REFERENCES public.tokens(address) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  holders jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{w: evm wallet, b: tokens, d: held days}]
  total_eligible_weight numeric NOT NULL DEFAULT 0
);
GRANT ALL ON public.holdout_snapshots TO service_role;
ALTER TABLE public.holdout_snapshots ENABLE ROW LEVEL SECURITY;
-- No public policy: snapshots are internal (service-role only).
