-- The currencies reference table no longer needs anonymous reads: the app never queries
-- it without a signed-in user (currency metadata lives in src/domain/money.ts).
-- Scope reads to authenticated users and drop the anonymous grant.

DROP POLICY "currencies readable" ON public.currencies;

CREATE POLICY "currencies readable" ON public.currencies
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.currencies FROM anon;