CREATE OR REPLACE FUNCTION public.admin_user_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'wallets', (SELECT count(DISTINCT trader) FROM public.trades),
    'wallets_1d', (SELECT count(DISTINCT trader) FROM public.trades WHERE created_at > now() - interval '1 day'),
    'wallets_7d', (SELECT count(DISTINCT trader) FROM public.trades WHERE created_at > now() - interval '7 days'),
    'wallets_new_1d', (SELECT count(*) FROM (SELECT trader FROM public.trades GROUP BY trader HAVING min(created_at) > now() - interval '1 day') n),
    'creators', (SELECT count(DISTINCT creator) FROM public.tokens),
    'profiles', (SELECT count(*) FROM public.wallet_profiles),
    'comment_authors', (SELECT count(DISTINCT author) FROM public.coin_comments),
    'trades', (SELECT count(*) FROM public.trades),
    'coins', (SELECT count(*) FROM public.tokens),
    'recent', (
      SELECT coalesce(jsonb_agg(r), '[]'::jsonb)
      FROM (
        SELECT t.trader AS wallet,
               count(*) AS trades,
               max(t.created_at) AS last_at,
               p.name AS name,
               p.avatar AS avatar
        FROM public.trades t
        LEFT JOIN public.wallet_profiles p ON lower(p.wallet) = lower(t.trader)
        GROUP BY t.trader, p.name, p.avatar
        ORDER BY max(t.created_at) DESC
        LIMIT 12
      ) r
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_stats() TO service_role;