ALTER TABLE public.wallet_profiles ADD COLUMN x_handle text;
ALTER TABLE public.wallet_profiles ALTER COLUMN edit_key_hash DROP NOT NULL;
COMMENT ON COLUMN public.wallet_profiles.edit_key_hash IS 'DEPRECATED: profile edits are now proven by a wallet signature';