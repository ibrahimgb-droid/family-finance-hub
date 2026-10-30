import { describe, expect, it } from "vitest";
import { normalizeReceiptItems, receiptItemSum, signedAmountToMinor } from "./receipt-items";

describe("itemized receipts", () => {
  it("keeps every printed item and its category in input order", () => {
    const items = normalizeReceiptItems([
      { description: "Milk", quantity: "2", unit_price: "0.650", total: "1.300", category: "Groceries" },
      { description: "Soap", quantity: "1", unit_price: "0.750", total: "0.750", category: "Personal care" },
    ], "KWD");
    expect(items.map((i) => [i.description, i.category, i.total_minor])).toEqual([["Milk", "Groceries", "1300"], ["Soap", "Personal care", "750"]]);
    expect(receiptItemSum(items)).toBe(2050n);
  });
  it("preserves discounts to the last fils", () => {
    expect(signedAmountToMinor("-0.125", "KWD")).toBe("-125");
  });
  it("does not invent or truncate unreadable prices", () => {
    expect(signedAmountToMinor("1.2345", "KWD")).toBeNull();
    expect(receiptItemSum([{ description: "Item", quantity: null, unit_price_minor: null, total_minor: null, category: "Other" }])).toBeNull();
  });
  it("falls back to Other for unrecognized categories", () => {
    expect(normalizeReceiptItems([{ description: "Unknown", quantity: null, unit_price: null, total: null, category: "Made up" }], "KWD")[0]?.category).toBe("Other");
  });
});