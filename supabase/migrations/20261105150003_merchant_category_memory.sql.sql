/*
# Merchant category memory

1. New Tables
- `merchant_category_memory` — remembers the last category a user chose for a given merchant.
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid(), references auth.users ON DELETE CASCADE
  - `merchant_key` text NOT NULL — normalized merchant name (trim + lower), 1..120 chars
  - `category_id` uuid NOT NULL — references categories(id) ON DELETE CASCADE
  - `updated_at` timestamptz DEFAULT now()
  - Unique constraint on (user_id, merchant_key) so there is one row per merchant per user.

2. Security
- Enable RLS on `merchant_category_memory`.
- GRANT SELECT, INSERT, UPDATE, DELETE to `authenticated` only.
- Four owner-scoped policies (select/insert/update/delete) using auth.uid() = user_id.
- The `user_id` column defaults to auth.uid() so client inserts that omit it succeed.

3. Indexes
- Unique index on (user_id, merchant_key) for upsert lookups.
*/
CREATE TABLE IF NOT EXISTS merchant_category_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_key text NOT NULL CHECK (char_length(merchant_key) >= 1 AND char_length(merchant_key) <= 120),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_category_memory_user_merchant_key UNIQUE (user_id, merchant_key)
);

ALTER TABLE merchant_category_memory ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_category_memory TO authenticated;

DROP POLICY IF EXISTS "select_own_merchant_memory" ON merchant_category_memory;
CREATE POLICY "select_own_merchant_memory" ON merchant_category_memory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_merchant_memory" ON merchant_category_memory;
CREATE POLICY "insert_own_merchant_memory" ON merchant_category_memory
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_merchant_memory" ON merchant_category_memory;
CREATE POLICY "update_own_merchant_memory" ON merchant_category_memory
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_merchant_memory" ON merchant_category_memory;
CREATE POLICY "delete_own_merchant_memory" ON merchant_category_memory
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
