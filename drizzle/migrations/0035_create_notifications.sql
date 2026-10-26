CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL CHECK (account ~ '^0\.0\.[0-9]{1,20}$'),
  kind text NOT NULL CHECK (kind IN ('new_follower','comment','graduation','follower_buy')),
  actor text CHECK (actor IS NULL OR actor ~ '^0\.0\.[0-9]{1,20}$'),
  token text,
  symbol text,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notifications_account_time_idx ON public.notifications (account, created_at DESC);
CREATE UNIQUE INDEX notifications_dedupe_uniq ON public.notifications (account, kind, dedupe_key) WHERE dedupe_key IS NOT NULL;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notification_prefs (
  account text NOT NULL CHECK (account ~ '^0\.0\.[0-9]{1,20}$'),
  kind text NOT NULL CHECK (kind IN ('new_follower','comment','graduation','follower_buy')),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account, kind)
);
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;