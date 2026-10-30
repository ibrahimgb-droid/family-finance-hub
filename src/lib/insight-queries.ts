import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildPriceInsights, type PriceReceipt } from "@/domain/price-insights";

export const insightsQuery = (userId: string) => queryOptions({
  queryKey: ["price-insights", userId],
  queryFn: async () => {
    const rows: PriceReceipt[] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from("transactions")
        .select("id,status,occurred_on,created_at,merchant,currency,line_items")
        .eq("user_id", userId).eq("status", "confirmed")
        .order("occurred_on").order("created_at").order("id").range(offset, offset + size - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < size) break;
    }
    return buildPriceInsights(rows);
  },
});