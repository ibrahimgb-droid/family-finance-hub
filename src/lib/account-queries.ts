import { supabase } from "@/integrations/supabase/client";
import type { AccountKind } from "@/domain/accounts";

export type Account = { id: string; name: string; kind: AccountKind; currency: string; opening_balance_minor: number | string; is_archived: boolean; counterparty: string | null };
export const accountsQueryKey = ["accounts"] as const;

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select("id, name, kind, currency, opening_balance_minor, is_archived, counterparty").order("created_at");
  if (error) throw error;
  return data as Account[];
}

export type TransferRow = { id: string; from_account_id: string; to_account_id: string; from_amount_minor: number | string; to_amount_minor: number | string; occurred_on: string; note: string | null };
export const accountTransfersQueryKey = ["account-transfers"] as const;

export async function fetchAccountTransfers(): Promise<TransferRow[]> {
  const { data, error } = await supabase.from("account_transfers").select("id, from_account_id, to_account_id, from_amount_minor, to_amount_minor, occurred_on, note").order("occurred_on", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data as TransferRow[];
}
