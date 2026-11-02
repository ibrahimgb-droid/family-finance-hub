ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.categories.is_hidden IS 'Hidden categories remain readable on historical expenses but are excluded from new expense choices.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;