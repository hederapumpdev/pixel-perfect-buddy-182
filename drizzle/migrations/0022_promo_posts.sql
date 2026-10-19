CREATE TABLE public.promo_posts (
  slot text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  text text,
  external_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slot, channel)
);

GRANT ALL ON public.promo_posts TO service_role;
ALTER TABLE public.promo_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_posts FROM anon, authenticated;