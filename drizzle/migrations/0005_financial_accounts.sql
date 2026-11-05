CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  kind text NOT NULL DEFAULT 'checking' CHECK (kind IN ('checking','savings','credit_card','cash','investment')),
  currency character(3) NOT NULL REFERENCES public.currencies(code),
  opening_balance_minor bigint NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts read" ON public.accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own accounts delete" ON public.accounts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX accounts_user_idx ON public.accounts(user_id);

ALTER TABLE public.transactions ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
CREATE INDEX transactions_account_idx ON public.transactions(account_id);

CREATE OR REPLACE FUNCTION public.transaction_account_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record;
BEGIN
  IF NEW.account_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id THEN RETURN NEW; END IF;
  SELECT user_id, currency INTO a FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND OR a.user_id <> NEW.user_id THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF a.currency <> NEW.currency THEN RAISE EXCEPTION 'Account currency must match the expense currency'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER transaction_account_guard BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transaction_account_guard();