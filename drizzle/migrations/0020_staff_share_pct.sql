ALTER TABLE public.staff_members
  ADD COLUMN share_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN rate_since timestamptz,
  ADD COLUMN earned_before numeric NOT NULL DEFAULT 0;
UPDATE public.staff_members SET rate_since = joined_at WHERE rate_since IS NULL;