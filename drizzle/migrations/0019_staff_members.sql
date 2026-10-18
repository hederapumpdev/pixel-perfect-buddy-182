CREATE TABLE public.staff_members (
  wallet text PRIMARY KEY,
  account_id text,
  name text NOT NULL,
  avatar text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_members TO anon, authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff readable" ON public.staff_members FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fee_total_between(p_network text, p_from timestamptz, p_to timestamptz)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(sum(fee), 0) FROM public.trades
  WHERE network = p_network AND created_at >= p_from AND created_at < p_to
$$;
GRANT EXECUTE ON FUNCTION public.fee_total_between(text, timestamptz, timestamptz) TO service_role;