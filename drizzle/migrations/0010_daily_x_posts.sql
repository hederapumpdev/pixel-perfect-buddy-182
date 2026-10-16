CREATE TABLE public.x_posting_state (id integer PRIMARY KEY CHECK (id = 1), enabled boolean NOT NULL DEFAULT true, pause_reason text, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.x_posting_state TO service_role;
ALTER TABLE public.x_posting_state ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.x_daily_posts (slot text PRIMARY KEY, text text NOT NULL, status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','sent','failed','unknown')), tweet_id text, error text, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.x_daily_posts TO service_role;
ALTER TABLE public.x_daily_posts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.acquire_x_posting_lease() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
WITH locked AS (INSERT INTO public.x_posting_state(id,lease_until) VALUES (1, now() + interval '90 seconds') ON CONFLICT(id) DO UPDATE SET lease_until = EXCLUDED.lease_until WHERE x_posting_state.enabled AND x_posting_state.pause_reason IS NULL AND (x_posting_state.lease_until IS NULL OR x_posting_state.lease_until < now()) RETURNING id) SELECT EXISTS(SELECT 1 FROM locked);
$$;
REVOKE ALL ON FUNCTION public.acquire_x_posting_lease() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_x_posting_lease() TO service_role;