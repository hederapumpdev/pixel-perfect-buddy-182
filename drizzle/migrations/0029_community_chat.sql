CREATE TABLE public.community_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author text NOT NULL, body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000), created_at timestamptz NOT NULL DEFAULT now(), removed_at timestamptz);
GRANT SELECT ON public.community_messages TO anon, authenticated;
GRANT ALL ON public.community_messages TO service_role;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY community_visible ON public.community_messages FOR SELECT TO anon, authenticated USING (removed_at IS NULL);
CREATE INDEX community_recent ON public.community_messages (created_at DESC, id DESC);
CREATE TABLE public.community_blocks (author text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.community_blocks TO service_role;
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.community_sessions (token_hash text PRIMARY KEY, author text NOT NULL, expires_at timestamptz NOT NULL);
GRANT ALL ON public.community_sessions TO service_role;
ALTER TABLE public.community_sessions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.send_community_message(p_token_hash text, p_body text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who text; mid uuid;
BEGIN
 SELECT author INTO who FROM public.community_sessions WHERE token_hash = p_token_hash AND expires_at > now();
 IF who IS NULL THEN RAISE EXCEPTION 'Chat session expired. Sign in again.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('community:' || who, 0));
 IF EXISTS (SELECT 1 FROM public.community_blocks WHERE author = who) THEN RAISE EXCEPTION 'This account is blocked from community chat.'; END IF;
 IF EXISTS (SELECT 1 FROM public.community_messages WHERE author = who AND created_at > now() - interval '10 seconds') THEN RAISE EXCEPTION 'Please wait 10 seconds between messages.'; END IF;
 INSERT INTO public.community_messages(author, body) VALUES(who, btrim(p_body)) RETURNING id INTO mid;
 RETURN mid;
END; $$;
REVOKE ALL ON FUNCTION public.send_community_message(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_community_message(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.moderate_community_author(p_author text, p_block boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('community:' || p_author, 0));
 IF p_block THEN INSERT INTO public.community_blocks(author) VALUES(p_author) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.community_blocks WHERE author = p_author; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.moderate_community_author(text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_community_author(text,boolean) TO service_role;