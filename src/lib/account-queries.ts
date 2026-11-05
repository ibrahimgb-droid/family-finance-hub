import { supabase } from "@/integrations/supabase/client";
import type { AccountKind } from "@/domain/accounts";

export type Account = { id: string; name: string; kind: AccountKind; currency: string; opening_balance_minor: number | string; is_archived: boolean };
export const accountsQueryKey = ["accounts"] as const;

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select("id, name, kind, currency, opening_balance_minor, is_archived").order("created_at");
  if (error) throw error;
  return data as Account[];
}
