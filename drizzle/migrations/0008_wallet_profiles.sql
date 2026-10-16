CREATE TABLE public.wallet_profiles (
  wallet text PRIMARY KEY,
  name text NOT NULL,
  bio text,
  avatar text,
  edit_key_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wallet_profiles_name_idx ON public.wallet_profiles (lower(name));
GRANT ALL ON public.wallet_profiles TO service_role;
ALTER TABLE public.wallet_profiles ENABLE ROW LEVEL SECURITY;