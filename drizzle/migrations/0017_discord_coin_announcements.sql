CREATE TABLE public.discord_coin_posts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 token text NOT NULL REFERENCES public.tokens(address),
 channel_id text NOT NULL,
 status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','unknown')),
 message_id text,
 memo text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 UNIQUE(token, channel_id)
);
GRANT ALL ON public.discord_coin_posts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.discord_coin_posts_id_seq TO service_role;
ALTER TABLE public.discord_coin_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages Discord posts" ON public.discord_coin_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE FUNCTION public.claim_discord_coin_post()
RETURNS TABLE(post_id bigint, token_address text, channel text, coin_name text, coin_symbol text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE selected_token text; selected_channel text; selected_name text; selected_symbol text; claimed_id bigint;
BEGIN
 IF NOT pg_try_advisory_xact_lock(10925881, 20261018) THEN RETURN; END IF;
 SELECT t.address, c.channel_id, t.name, t.symbol INTO selected_token, selected_channel, selected_name, selected_symbol
 FROM public.tokens t CROSS JOIN (VALUES ('1561016069026742332'::text), ('1561015894983839805'::text)) c(channel_id)
 WHERE t.network = 'mainnet' AND t.created_at >= '2026-10-18T00:00:00Z' AND t.contract IN ('0.0.10924256','0.0.10924285','0.0.10924813','0.0.10925851','0.0.10925881')
 AND NOT EXISTS (SELECT 1 FROM public.discord_coin_posts p WHERE p.token=t.address AND p.channel_id=c.channel_id)
 ORDER BY t.created_at, c.channel_id LIMIT 1;
 IF selected_token IS NULL THEN RETURN; END IF;
 INSERT INTO public.discord_coin_posts(token,channel_id) VALUES(selected_token,selected_channel) ON CONFLICT DO NOTHING RETURNING id INTO claimed_id;
 IF claimed_id IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT claimed_id, selected_token, selected_channel, selected_name, selected_symbol;
END $$;
REVOKE ALL ON FUNCTION public.claim_discord_coin_post() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_discord_coin_post() TO service_role;