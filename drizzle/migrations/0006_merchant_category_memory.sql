CREATE TABLE IF NOT EXISTS public.merchant_category_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  merchant_key text NOT NULL CHECK (char_length(merchant_key) BETWEEN 1 AND 120),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, merchant_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_category_memory TO authenticated;
GRANT ALL ON public.merchant_category_memory TO service_role;
ALTER TABLE public.merchant_category_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory read" ON public.merchant_category_memory FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own memory insert" ON public.merchant_category_memory FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = auth.uid()));
CREATE POLICY "own memory update" ON public.merchant_category_memory FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = auth.uid()));
CREATE POLICY "own memory delete" ON public.merchant_category_memory FOR DELETE TO authenticated USING (user_id = auth.uid());