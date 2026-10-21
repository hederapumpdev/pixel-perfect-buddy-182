-- Three-wallet fee split + Hold Out holder rewards. Service-role only ledgers.

CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id text PRIMARY KEY,                -- unique claim key, e.g. split:<hour>:team, fund:split
  kind text NOT NULL,                 -- fund | claim | split
  from_wallet text NOT NULL,
  recipient text NOT NULL,
  tinybars bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | sent | done | failed | unknown
  tx_hash text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wallet_transfers TO service_role;
ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages wallet transfers" ON public.wallet_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS wallet_transfers_status_idx ON public.wallet_transfers (status, created_at);

-- One row per coin per snapshot slot; lots and weights are stored in the same row so a
-- snapshot is written atomically and can never be counted twice.
CREATE TABLE IF NOT EXISTS public.holdout_snapshots (
  token text NOT NULL,
  slot timestamptz NOT NULL,
  period text NOT NULL,
  supply numeric NOT NULL DEFAULT 0,  -- eligible supply S_t
  lots jsonb NOT NULL DEFAULT '{}'::jsonb,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token, slot)
);
GRANT ALL ON public.holdout_snapshots TO service_role;
ALTER TABLE public.holdout_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages holdout snapshots" ON public.holdout_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS holdout_snapshots_period_idx ON public.holdout_snapshots (period);

CREATE TABLE IF NOT EXISTS public.holdout_periods (
  period text PRIMARY KEY,
  status text NOT NULL DEFAULT 'planning', -- planning | ready
  pot_tinybars bigint NOT NULL DEFAULT 0,
  planned_tinybars bigint NOT NULL DEFAULT 0,
  residual_tinybars bigint NOT NULL DEFAULT 0,  -- carried into the next week
  coins jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.holdout_periods TO service_role;
ALTER TABLE public.holdout_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages holdout periods" ON public.holdout_periods FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.holdout_payouts (
  id text PRIMARY KEY,               -- <period>:<account>
  period text NOT NULL,
  account text NOT NULL,
  tinybars bigint NOT NULL,
  coins jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planned', -- planned | pending | sent | done | failed | unknown
  tx_hash text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period, account)
);
GRANT ALL ON public.holdout_payouts TO service_role;
ALTER TABLE public.holdout_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages holdout payouts" ON public.holdout_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS holdout_payouts_status_idx ON public.holdout_payouts (status);
CREATE INDEX IF NOT EXISTS holdout_payouts_account_idx ON public.holdout_payouts (account);
