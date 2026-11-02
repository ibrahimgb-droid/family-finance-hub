/*
# Receipt line items on transactions

1. Plain-English summary
- Stores the reviewed items from a receipt (description, quantity, prices, category) on the transaction itself, as one snapshot.

2. Changes
- transactions.line_items: JSON array, defaults to empty; must be an array.
- Trigger: once a transaction is no longer a draft, its items cannot be changed.

3. Security
- No change to access rules; the existing transaction policies still apply.
*/

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  ALTER TABLE public.transactions ADD CONSTRAINT tx_line_items_array CHECK (jsonb_typeof(line_items) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
COMMENT ON COLUMN public.transactions.line_items IS 'Reviewed receipt items: description, quantity decimal text, unit_price_minor and total_minor integer strings or null, category label. Included within the parent transaction total, never separately posted.';
CREATE OR REPLACE FUNCTION public.guard_receipt_line_items() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' AND NEW.line_items IS DISTINCT FROM OLD.line_items THEN
    RAISE EXCEPTION 'Items on a posted transaction cannot be changed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_line_items_guard ON public.transactions;
CREATE TRIGGER tx_line_items_guard BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.guard_receipt_line_items();
