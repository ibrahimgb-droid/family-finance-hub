-- Loan account kinds, counterparty, account transfers and computed balances.
-- Sign convention: opening_balance_minor for credit_card and loan_borrowed is the amount
-- OWED, entered positive; balances of debt accounts are negative. Transfers are separate
-- from transactions so spending summaries never count them.

-- 1. Account kinds and loan counterparty
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_kind_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_kind_check
  CHECK (kind IN ('checking','savings','credit_card','cash','investment','loan_lent','loan_borrowed'));

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS counterparty text;
DO $$ BEGIN
  ALTER TABLE public.accounts ADD CONSTRAINT accounts_counterparty_check
    CHECK (counterparty IS NULL OR char_length(btrim(counterparty)) BETWEEN 1 AND 80);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Transfers
CREATE TABLE public.account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  from_amount_minor bigint NOT NULL CHECK (from_amount_minor > 0),
  to_amount_minor bigint NOT NULL CHECK (to_amount_minor > 0),
  occurred_on date NOT NULL DEFAULT current_date,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX account_transfers_user_date_idx ON public.account_transfers(user_id, occurred_on DESC);
CREATE INDEX account_transfers_from_idx ON public.account_transfers(from_account_id);
CREATE INDEX account_transfers_to_idx ON public.account_transfers(to_account_id);

CREATE OR REPLACE FUNCTION public.account_transfer_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE f record; t record;
BEGIN
  SELECT user_id, currency INTO f FROM public.accounts WHERE id = NEW.from_account_id;
  SELECT user_id, currency INTO t FROM public.accounts WHERE id = NEW.to_account_id;
  IF f.user_id IS DISTINCT FROM NEW.user_id OR t.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  IF f.currency = t.currency AND NEW.from_amount_minor <> NEW.to_amount_minor THEN
    RAISE EXCEPTION 'Same-currency transfers must have equal amounts';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER account_transfer_guard BEFORE INSERT OR UPDATE ON public.account_transfers
FOR EACH ROW EXECUTE FUNCTION public.account_transfer_guard();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;
GRANT ALL ON public.account_transfers TO service_role;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own transfers read" ON public.account_transfers
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own transfers insert" ON public.account_transfers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own transfers update" ON public.account_transfers
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own transfers delete" ON public.account_transfers
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. Computed balances (security_invoker: RLS on base tables still applies)
CREATE OR REPLACE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.currency,
  (CASE WHEN a.kind IN ('credit_card','loan_borrowed')
        THEN -a.opening_balance_minor ELSE a.opening_balance_minor END)
    - COALESCE((SELECT sum(t.total_minor) FROM public.transactions t
                WHERE t.account_id = a.id AND t.status = 'confirmed'), 0)
    - COALESCE((SELECT sum(x.from_amount_minor) FROM public.account_transfers x
                WHERE x.from_account_id = a.id), 0)
    + COALESCE((SELECT sum(x.to_amount_minor) FROM public.account_transfers x
                WHERE x.to_account_id = a.id), 0)
  AS balance_minor
FROM public.accounts a;

GRANT SELECT ON public.account_balances TO authenticated;
GRANT ALL ON public.account_balances TO service_role;