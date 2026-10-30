import { describe, expect, it } from "vitest";
import { buildPriceInsights, formatPricePercent, type PriceReceipt } from "./price-insights";

function receipt(id: string, price: string, overrides: Partial<PriceReceipt> = {}): PriceReceipt {
  return { id, status: "confirmed", occurred_on: `2026-10-${id === "a" ? "01" : "02"}`, created_at: `${id}`, merchant: "Store", currency: "KWD", line_items: [{ description: "Milk 1L", quantity: "1", unit_price_minor: price, total_minor: price, category: "Groceries" }], ...overrides };
}
describe("same-item price insights", () => {
  it("detects an increase to the last KWD fils", () => {
    const result = buildPriceInsights([receipt("b", "751"), receipt("a", "650")]);
    expect(result.changes[0]?.change).toBe(101n);
    expect(formatPricePercent(101n, 650n)).toBe("+15.54%");
  });
  it("detects decreases", () => { expect(buildPriceInsights([receipt("a", "750"), receipt("b", "650")]).changes[0]?.change).toBe(-100n); });
  it("excludes drafts", () => { expect(buildPriceInsights([receipt("a", "650"), receipt("b", "750", { status: "draft" })]).changes).toEqual([]); });
  it("never mixes currencies", () => { expect(buildPriceInsights([receipt("a", "650"), receipt("b", "750", { currency: "USD" })]).changes).toEqual([]); });
  it("does not mistake increased quantities for a price change", () => {
    expect(buildPriceInsights([receipt("a", "650"), receipt("b", "650", { line_items: [{ description: "Milk 1L", quantity: "2", unit_price_minor: "650", total_minor: "1300" }] })]).changes).toEqual([]);
  });
  it("matches only normalized descriptions, preserving package sizes", () => {
    expect(buildPriceInsights([receipt("a", "650"), receipt("b", "750", { line_items: [{ description: "  MILK   1L ", unit_price_minor: "750" }] })]).changes).toHaveLength(1);
    expect(buildPriceInsights([receipt("a", "650"), receipt("b", "750", { line_items: [{ description: "Milk 2L", unit_price_minor: "750" }] })]).changes).toEqual([]);
  });
  it("does not compare duplicated rows within the same receipt", () => {
    const tx = receipt("a", "650");
    tx.line_items = [{ description: "Milk 1L", unit_price_minor: "650" }, { description: "Milk 1L", unit_price_minor: "750" }];
    expect(buildPriceInsights([tx]).changes).toEqual([]);
  });
  it("compares only the latest two purchases and omits unchanged prices", () => {
    expect(buildPriceInsights([receipt("a", "650"), receipt("b", "750"), receipt("c", "750", { occurred_on: "2026-10-03" })]).changes).toEqual([]);
  });
  it("uses single-item totals but never guesses missing quantity", () => {
    expect(buildPriceInsights([receipt("a", "650"), receipt("b", "750", { line_items: [{ description: "Milk 1L", quantity: "1", total_minor: "750" }] })]).changes).toHaveLength(1);
    expect(buildPriceInsights([receipt("a", "650"), receipt("b", "750", { line_items: [{ description: "Milk 1L", total_minor: "750" }] })]).changes).toEqual([]);
  });
});