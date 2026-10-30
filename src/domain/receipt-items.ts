import { parseToMinor } from "./money";
import { scrubPan } from "./receipt";

export const RECEIPT_CATEGORIES = ["Groceries", "Dining", "Household", "Personal care", "Health", "Clothing", "Electronics", "Transport", "Utilities", "Entertainment", "Education", "Other"] as const;
export type ReceiptItem = {
  description: string;
  quantity: string | null;
  unit_price_minor: string | null;
  total_minor: string | null;
  category: string;
};
export type ExtractedItem = { description: string; quantity: string | null; unit_price: string | null; total: string | null; category: string };

export function signedAmountToMinor(value: string | null, currency: string): string | null {
  if (!value) return null;
  const text = value.trim();
  try {
    const negative = text.startsWith("-");
    const amount = parseToMinor(negative ? text.slice(1) : text, currency);
    return (negative ? -amount : amount).toString();
  } catch { return null; }
}

export function normalizeReceiptItems(items: ExtractedItem[], currency: string): ReceiptItem[] {
  return items.map((item) => ({
    description: scrubPan(item.description).slice(0, 200) || "Unreadable item",
    quantity: item.quantity && /^\d+(?:\.\d+)?$/.test(item.quantity.trim()) ? item.quantity.trim() : null,
    unit_price_minor: signedAmountToMinor(item.unit_price, currency),
    total_minor: signedAmountToMinor(item.total, currency),
    category: RECEIPT_CATEGORIES.find((c) => c === item.category) ?? "Other",
  }));
}

export function receiptItemSum(items: ReceiptItem[]): bigint | null {
  if (items.some((item) => item.total_minor === null)) return null;
  return items.reduce((sum, item) => sum + BigInt(item.total_minor ?? "0"), 0n);
}