/*
# Expense categories: hidden flag, default categories for new users, ownership guard

1. Plain-English summary
- Each user gets the same starting set of twelve categories when they sign up (Groceries, Dining, Household, and so on).
- Categories can be hidden instead of deleted, so old expenses keep their label.
- An expense can only be given a category that belongs to the same user.

2. Changes
- categories.is_hidden (boolean, default false).
- New-user trigger now also creates the default categories.
- Existing users without categories receive the defaults (no duplicates).
- Trigger on transactions: rejects a category that is not owned by the transaction's user.

3. Security
- No new tables, so no new policies are needed. The existing categories and transactions policies still apply.
- The ownership trigger stops a user from attaching someone else's category id to their own expense.

4. Important notes
- The default names must match the receipt category list used by the scanner, so scanned items map to the right categories.
*/

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.default_category_names() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['Groceries','Dining','Household','Personal care','Health','Clothing','Electronics','Transport','Utilities','Entertainment','Education','Other']::text[]
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 80))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.entitlements (user_id) VALUES (new.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.categories (user_id, name)
  SELECT new.id, unnest(public.default_category_names())
  ON CONFLICT (user_id, name) DO NOTHING;
  RETURN new;
END $$;

INSERT INTO public.categories (user_id, name)
SELECT p.id, unnest(public.default_category_names())
FROM public.profiles p
ON CONFLICT (user_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_transaction_category_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF new.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories c WHERE c.id = new.category_id AND c.user_id = new.user_id
  ) THEN
    RAISE EXCEPTION 'category does not belong to this user';
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS tx_category_owner_guard ON public.transactions;
CREATE TRIGGER tx_category_owner_guard BEFORE INSERT OR UPDATE OF category_id, user_id ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_category_owner();
