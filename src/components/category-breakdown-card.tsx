import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMinor } from "@/domain/money";
import { sumByCategory } from "@/domain/categories";
import { Button } from "@/components/ui/button";
import { Tags } from "lucide-react";

type MonthRow = { total_minor: number | string; categories: { name: string } | null };

export function CategoryBreakdownCard({ today }: { today: string }) {
  const monthStart = `${today.slice(0, 7)}-01`;

  const profile = useQuery({
    queryKey: ["profile-currency"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("default_currency").maybeSingle();
      if (error) throw error;
      return (data?.default_currency as string | undefined) ?? "KWD";
    },
  });

  const currency = profile.data;
  const breakdown = useQuery({
    enabled: Boolean(currency),
    queryKey: ["category-breakdown", monthStart, currency],
    queryFn: async () => {
      if (!currency) return [];
      const { data, error } = await supabase.from("transactions")
        .select("total_minor, categories(name)")
        .eq("status", "confirmed").eq("currency", currency).gte("occurred_on", monthStart).lte("occurred_on", today);
      if (error) throw error;
      return data as unknown as MonthRow[];
    },
  });

  const rows = breakdown.data ?? [];
  const totals = sumByCategory(rows.map((row) => ({ category: row.categories?.name ?? null, amount: BigInt(row.total_minor) })));
  const sorted = [...totals].sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));
  const grand = sorted.reduce((sum, [, amount]) => sum + amount, 0n);

  return (
    <article className="bento-tile col-span-2 flex flex-col bg-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="utility-label text-muted-foreground">THIS MONTH BY CATEGORY</p>
        <Tags className="size-4 text-primary" />
      </div>
      {currency && <p className="mt-2 text-xs text-muted-foreground">Confirmed {currency} expenses</p>}

      {breakdown.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {breakdown.error && <p className="mt-4 text-sm text-destructive">Couldn't load this month's categories.</p>}
      {!breakdown.isLoading && !breakdown.error && sorted.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No confirmed expenses this month yet.</p>
      )}

      <ul className="mt-4 space-y-3">
        {sorted.map(([name, amount]) => {
          const share = grand > 0n ? Number((amount * 100n) / grand) : 0;
          return (
            <li key={name ?? "uncategorized"}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{name ?? "Uncategorized"}</span>
                <span className="shrink-0 font-semibold">{formatMinor(amount, currency ?? "KWD")}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${share}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-border pt-4">
        <Button asChild variant="outline" size="sm"><Link to="/categories"><Tags /> Manage categories</Link></Button>
      </div>
    </article>
  );
}
