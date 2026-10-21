CREATE TABLE public.admin_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.admin_log TO service_role;
ALTER TABLE public.admin_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages admin log" ON public.admin_log FOR ALL TO service_role USING (true) WITH CHECK (true);