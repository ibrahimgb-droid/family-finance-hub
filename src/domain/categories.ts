import { RECEIPT_CATEGORIES } from "./receipt-items";

export function isCustomCategory(name: string): boolean {
  return !RECEIPT_CATEGORIES.some((category) => category.toLowerCase() === name.trim().toLowerCase());
}

export function normalizeMerchant(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

export type CategorySuggestionInput = {
  merchantMemory: string | null;
  largestItemCategory: string | null;
};

export type ResolvedCategorySuggestion = {
  source: "merchant" | "items" | null;
  categoryName: string | null;
};

export function resolveCategorySuggestion(
  input: CategorySuggestionInput,
  options: { availableCategoryNames?: ReadonlySet<string>; hiddenCategoryNames?: ReadonlySet<string> } = {},
): ResolvedCategorySuggestion {
  const available = options.availableCategoryNames;
  const hidden = options.hiddenCategoryNames;
  const isVisible = (name: string): boolean => {
    if (hidden?.has(name)) return false;
    if (available && !available.has(name)) return false;
    return true;
  };

  if (input.merchantMemory && isVisible(input.merchantMemory)) {
    return { source: "merchant", categoryName: input.merchantMemory };
  }
  if (input.largestItemCategory && isVisible(input.largestItemCategory)) {
    return { source: "items", categoryName: input.largestItemCategory };
  }
  return { source: null, categoryName: null };
}

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
