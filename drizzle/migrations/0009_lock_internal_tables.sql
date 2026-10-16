DROP POLICY IF EXISTS "Bot settings are public" ON public.bot_settings;
DROP POLICY IF EXISTS "Bot buys are public on-chain activity" ON public.bot_buys;
DROP POLICY IF EXISTS "Comments are public" ON public.coin_comments;
DROP POLICY IF EXISTS "public read texts" ON public.token_texts;
REVOKE SELECT ON public.bot_settings, public.bot_buys, public.coin_comments, public.token_texts FROM anon, authenticated;