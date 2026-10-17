CREATE TABLE public.telegram_channel_state (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 chat_id text NOT NULL DEFAULT '@hederapump',
 message_id bigint,
 status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','sending','unknown')),
 lease_until timestamptz,
 updated_at timestamptz,
 last_error text
);
GRANT ALL ON public.telegram_channel_state TO service_role;
ALTER TABLE public.telegram_channel_state ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.telegram_graduation_posts (
 token text PRIMARY KEY,
 network text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','unknown')),
 message_id bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 last_error text
);
GRANT ALL ON public.telegram_graduation_posts TO service_role;
ALTER TABLE public.telegram_graduation_posts ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.enqueue_telegram_graduation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.graduated = true AND OLD.graduated IS DISTINCT FROM true THEN
 INSERT INTO public.telegram_graduation_posts(token, network) VALUES (NEW.address, NEW.network) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_telegram_graduation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER telegram_graduation_event AFTER UPDATE OF graduated ON public.tokens FOR EACH ROW EXECUTE FUNCTION public.enqueue_telegram_graduation();
CREATE OR REPLACE FUNCTION public.acquire_telegram_top_lease() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acquired integer;
BEGIN
 INSERT INTO public.telegram_channel_state(id) VALUES(1) ON CONFLICT DO NOTHING;
 UPDATE public.telegram_channel_state SET lease_until = now() + interval '60 seconds' WHERE id = 1 AND (lease_until IS NULL OR lease_until < now()) AND status = 'ready';
 GET DIAGNOSTICS acquired = ROW_COUNT;
 RETURN acquired = 1;
END; $$;
REVOKE ALL ON FUNCTION public.acquire_telegram_top_lease() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_telegram_top_lease() TO service_role;
CREATE OR REPLACE FUNCTION public.claim_telegram_graduation(p_network text) RETURNS SETOF public.telegram_graduation_posts LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.telegram_graduation_posts SET status = 'sending'
 WHERE token = (SELECT token FROM public.telegram_graduation_posts WHERE network = p_network AND status IN ('pending','failed') ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_telegram_graduation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_graduation(text) TO service_role;