ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
UPDATE public.staff_members SET is_admin = true WHERE account_id IN ('0.0.10924360', '0.0.10927842');