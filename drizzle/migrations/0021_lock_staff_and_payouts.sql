DROP POLICY IF EXISTS "staff readable" ON public.staff_members;
DROP POLICY IF EXISTS "payouts readable" ON public.bot_payouts;
REVOKE ALL ON public.staff_members FROM anon, authenticated;
REVOKE ALL ON public.bot_payouts FROM anon, authenticated;
GRANT ALL ON public.staff_members TO service_role;
GRANT ALL ON public.bot_payouts TO service_role;