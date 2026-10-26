ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('new_follower','comment','graduation','follower_buy','follower_sell','follower_launch','follower_comment','follower_graduation'));
ALTER TABLE public.notification_prefs DROP CONSTRAINT IF EXISTS notification_prefs_kind_check;
ALTER TABLE public.notification_prefs ADD CONSTRAINT notification_prefs_kind_check CHECK (kind IN ('new_follower','comment','graduation','follower_buy','follower_sell','follower_launch','follower_comment','follower_graduation'));
ALTER TABLE public.wallet_profiles ADD COLUMN IF NOT EXISTS banner text;