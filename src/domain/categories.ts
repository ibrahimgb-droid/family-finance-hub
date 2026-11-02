export type CategorizedAmount = { category: string | null; amount: bigint };

export function sumByCategory(rows: CategorizedAmount[]): Map<string | null, bigint> {
  const totals = new Map<string | null, bigint>();
  for (const row of rows) totals.set(row.category, (totals.get(row.category) ?? 0n) + row.amount);
  return totals;
}

export function suggestCategoryName(items: { category: string; total: bigint | null }[]): string | null {
  const totals = new Map<string, bigint>();
  for (const item of items) {
    if (item.total === null) continue;
    totals.set(item.category, (totals.get(item.category) ?? 0n) + item.total);
  }
  let best: string | null = null;
  let bestTotal = 0n;
  for (const [category, total] of totals) {
    if (best === null || total > bestTotal) {
      best = category;
      bestTotal = total;
    }
  }
  return best;
}
