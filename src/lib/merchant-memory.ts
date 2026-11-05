import { supabase } from "@/integrations/supabase/client";
import { normalizeMerchant } from "@/domain/categories";

export const merchantMemoryQueryKey = ["merchant-memory"] as const;

export async function fetchMerchantMemoryMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("merchant_category_memory")
    .select("merchant_key, categories!inner(name)");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data as { merchant_key: string; categories: { name: string } }[]) {
    map.set(row.merchant_key, row.categories.name);
  }
  return map;
}

export async function rememberMerchantCategory(merchant: string, categoryId: string): Promise<void> {
  const key = normalizeMerchant(merchant);
  if (!key) return;
  const { error } = await supabase
    .from("merchant_category_memory")
    .upsert({ merchant_key: key, category_id: categoryId }, { onConflict: "user_id,merchant_key" });
  if (error) throw error;
}
