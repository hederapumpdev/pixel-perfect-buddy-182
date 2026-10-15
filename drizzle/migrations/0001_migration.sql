CREATE TABLE public.token_images (
  hash text PRIMARY KEY,
  mime text NOT NULL,
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.token_images TO service_role;
ALTER TABLE public.token_images ENABLE ROW LEVEL SECURITY;