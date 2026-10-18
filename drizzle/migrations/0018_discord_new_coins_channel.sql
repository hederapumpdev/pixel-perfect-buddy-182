CREATE OR REPLACE FUNCTION public.claim_discord_coin_post()
RETURNS TABLE(post_id bigint, token_address text, channel text, coin_name text, coin_symbol text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE selected_token text; selected_name text; selected_symbol text; claimed_id bigint;
BEGIN
 IF NOT pg_try_advisory_xact_lock(10925881, 20261018) THEN RETURN; END IF;
 SELECT t.address, t.name, t.symbol INTO selected_token, selected_name, selected_symbol
 FROM public.tokens t
 WHERE t.network = 'mainnet' AND t.created_at >= '2026-10-18T00:00:00Z' AND t.contract IN ('0.0.10924256','0.0.10924285','0.0.10924813','0.0.10925851','0.0.10925881')
 AND NOT EXISTS (SELECT 1 FROM public.discord_coin_posts p WHERE p.token=t.address AND p.channel_id='1561344278591045693')
 ORDER BY t.created_at LIMIT 1;
 IF selected_token IS NULL THEN RETURN; END IF;
 INSERT INTO public.discord_coin_posts(token,channel_id) VALUES(selected_token,'1561344278591045693') ON CONFLICT DO NOTHING RETURNING id INTO claimed_id;
 IF claimed_id IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT claimed_id, selected_token, '1561344278591045693'::text, selected_name, selected_symbol;
END $$;
REVOKE ALL ON FUNCTION public.claim_discord_coin_post() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_discord_coin_post() TO service_role;