import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string; is_hidden: boolean };

export const categoriesQueryKey = ["categories"] as const;

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, is_hidden")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Category[];
}
