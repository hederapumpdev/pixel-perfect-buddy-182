CREATE TABLE public.wallet_follows (
  follower text NOT NULL,
  followee text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower, followee),
  CHECK (follower <> followee),
  CHECK (follower ~ '^0\.0\.[0-9]{1,20}$' AND followee ~ '^0\.0\.[0-9]{1,20}$')
);
CREATE INDEX wallet_follows_followee_idx ON public.wallet_follows (followee, created_at DESC);
GRANT ALL ON public.wallet_follows TO service_role;
ALTER TABLE public.wallet_follows ENABLE ROW LEVEL SECURITY;