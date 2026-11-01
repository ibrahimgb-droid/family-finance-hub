import { CURRENCY_DIGITS } from "./money";

export type PriceReceipt = {
  id: string; status: string; occurred_on: string; created_at: string; merchant: string | null;
  currency: string; line_items: unknown;
};
export type PriceObservation = { receiptId: string; date: string; createdAt: string; merchant: string; price: bigint };
export type PriceInsight = {
  key: string; description: string; category: string; currency: string;
  previous: PriceObservation; latest: PriceObservation; history: PriceObservation[]; change: bigint;
};

export function normalizeItemName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").trim().replace(/\s+/g, " ");
}

function positiveMinor(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const amount = BigInt(value);
  return amount > 0n ? amount : null;
}

// Use a printed unit price, or an explicitly single-unit line total. Do not guess quantities.
function comparablePrice(item: Record<string, unknown>): bigint | null {
  if (typeof item['total_minor'] === "string" && /^-\d+$/.test(item['total_minor'])) return null;
  const unit = positiveMinor(item['unit_price_minor']);
  if (unit !== null) return unit;
  if (typeof item['quantity'] === "string" && /^0*1(?:\.0+)?$/.test(item['quantity'].trim())) return positiveMinor(item['total_minor']);
  return null;
}

export function buildPriceInsights(receipts: PriceReceipt[]): { changes: PriceInsight[]; trackedItems: number } {
  const groups = new Map<string, { description: string; category: string; currency: string; observations: PriceObservation[] }>();
  for (const receipt of receipts) {
    if (receipt.status !== "confirmed" || CURRENCY_DIGITS[receipt.currency] === undefined || !Array.isArray(receipt.line_items)) continue;
    const withinReceipt = new Map<string, { description: string; category: string; price: bigint; conflict: boolean }>();
    for (const raw of receipt.line_items) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const item = raw as Record<string, unknown>;
      if (typeof item['description'] !== "string") continue;
      const name = normalizeItemName(item['description']);
      if (!name || ["unreadable item", "unknown", "item", "discount"].includes(name)) continue;
      const price = comparablePrice(item);
      if (price === null) continue;
      const existing = withinReceipt.get(name);
      if (existing) { existing.conflict ||= existing.price !== price; continue; }
      withinReceipt.set(name, { description: item['description'], category: typeof item['category'] === "string" ? item['category'] : "Other", price, conflict: false });
    }
    for (const [name, item] of withinReceipt) {
      if (item.conflict) continue;
      const key = `${receipt.currency}:${name}`;
      const group = groups.get(key) ?? { description: item.description, category: item.category, currency: receipt.currency, observations: [] };
      group.observations.push({ receiptId: receipt.id, date: receipt.occurred_on, createdAt: receipt.created_at, merchant: receipt.merchant ?? "Unknown store", price: item.price });
      groups.set(key, group);
    }
  }
  const changes: PriceInsight[] = [];
  for (const [key, group] of groups) {
    const history = group.observations.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.receiptId.localeCompare(b.receiptId));
    const latest = history.at(-1), previous = history.at(-2);
    if (!latest || !previous || latest.price === previous.price) continue;
    changes.push({ key, description: group.description, category: group.category, currency: group.currency, previous, latest, history, change: latest.price - previous.price });
  }
  changes.sort((a, b) => b.latest.date.localeCompare(a.latest.date) || a.description.localeCompare(b.description));
  return { changes, trackedItems: groups.size };
}

export function formatPricePercent(change: bigint, previous: bigint): string {
  if (previous <= 0n) return "—";
  const abs = change < 0n ? -change : change;
  const hundredths = (abs * 10000n + previous / 2n) / previous;
  return `${change < 0n ? "−" : "+"}${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}%`;
}