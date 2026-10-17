CREATE TABLE public.telegram_app_posts (
 slot text PRIMARY KEY,
 status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','unknown')),
 message_id bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_error text
);
GRANT ALL ON public.telegram_app_posts TO service_role;
ALTER TABLE public.telegram_app_posts ENABLE ROW LEVEL SECURITY;