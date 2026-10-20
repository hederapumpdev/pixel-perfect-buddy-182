CREATE OR REPLACE FUNCTION public.validate_staff_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allocated numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(10927104, 20);
  IF NEW.left_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.share_pct < 0 OR NEW.share_pct > 20 OR NEW.share_pct::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Percentage must be 0–20%%';
  END IF;
  SELECT COALESCE(SUM(share_pct), 0) INTO allocated
  FROM public.staff_members
  WHERE left_at IS NULL AND wallet <> NEW.wallet;
  IF allocated + NEW.share_pct > 20 THEN
    RAISE EXCEPTION 'Active staff together may receive at most 20%% of the platform share';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_staff_allocation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_staff_allocation() TO service_role;
CREATE TRIGGER staff_shared_allocation_cap
BEFORE INSERT OR UPDATE OF share_pct, left_at ON public.staff_members
FOR EACH ROW EXECUTE FUNCTION public.validate_staff_allocation();