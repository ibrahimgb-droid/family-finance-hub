ALTER TABLE public.transactions ADD COLUMN line_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD CONSTRAINT tx_line_items_array CHECK (jsonb_typeof(line_items) = 'array');
COMMENT ON COLUMN public.transactions.line_items IS 'Reviewed receipt items: description, quantity decimal text, unit_price_minor and total_minor integer strings or null, category label. Included within the parent transaction total, never separately posted.';
CREATE OR REPLACE FUNCTION public.guard_receipt_line_items() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' AND NEW.line_items IS DISTINCT FROM OLD.line_items THEN
    RAISE EXCEPTION 'Items on a posted transaction cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tx_line_items_guard BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.guard_receipt_line_items();