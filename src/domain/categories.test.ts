import { describe, expect, it } from "vitest";
import { isCustomCategory, normalizeMerchant, resolveCategorySuggestion, suggestCategoryName, sumByCategory } from "./categories";

describe("custom category deletion", () => {
  it("offers deletion for custom category names", () => {
    expect(isCustomCategory("Car repairs")).toBe(true);
  });
  it("keeps default categories out of the custom delete action", () => {
    expect(isCustomCategory("Groceries")).toBe(false);
    expect(isCustomCategory(" household ")).toBe(false);
  });
});

describe("suggestCategoryName", () => {
  it("returns the category with the largest total", () => {
    expect(suggestCategoryName([
      { category: "Groceries", total: 3000n },
      { category: "Household", total: 9000n },
      { category: "Groceries", total: 2000n },
    ])).toBe("Household");
  });

  it("breaks ties by first appearance", () => {
    expect(suggestCategoryName([
      { category: "Dining", total: 500n },
      { category: "Transport", total: 500n },
    ])).toBe("Dining");
  });

  it("ignores items without a total", () => {
    expect(suggestCategoryName([
      { category: "Dining", total: null },
      { category: "Transport", total: 100n },
    ])).toBe("Transport");
  });

  it("returns null when there are no priced items", () => {
    expect(suggestCategoryName([])).toBeNull();
    expect(suggestCategoryName([{ category: "Dining", total: null }])).toBeNull();
  });

  it("lets discounts reduce a category's total", () => {
    expect(suggestCategoryName([
      { category: "Groceries", total: 5000n },
      { category: "Dining", total: 4000n },
      { category: "Groceries", total: -2000n },
    ])).toBe("Dining");
  });
});

describe("sumByCategory", () => {
  it("sums amounts per category, keeping uncategorized rows under null", () => {
    const totals = sumByCategory([
      { category: "a", amount: 100n },
      { category: null, amount: 50n },
      { category: "a", amount: 25n },
    ]);
    expect(totals.get("a")).toBe(125n);
    expect(totals.get(null)).toBe(50n);
  });
});

describe("normalizeMerchant", () => {
  it("trims, lowercases and collapses internal whitespace", () => {
    expect(normalizeMerchant("  Sultan   Center ")).toBe("sultan center");
  });
  it("caps at 120 characters", () => {
    expect(normalizeMerchant("x".repeat(200)).length).toBe(120);
  });
  it("returns empty string for whitespace-only input", () => {
    expect(normalizeMerchant("   ")).toBe("");
  });
});

describe("resolveCategorySuggestion", () => {
  it("prefers merchant memory over item suggestion", () => {
    expect(resolveCategorySuggestion({ merchantMemory: "Groceries", largestItemCategory: "Dining" })).toEqual({
      source: "merchant",
      categoryName: "Groceries",
    });
  });

  it("falls back to largest item when no merchant memory", () => {
    expect(resolveCategorySuggestion({ merchantMemory: null, largestItemCategory: "Dining" })).toEqual({
      source: "items",
      categoryName: "Dining",
    });
  });

  it("returns null when neither is available", () => {
    expect(resolveCategorySuggestion({ merchantMemory: null, largestItemCategory: null })).toEqual({
      source: null,
      categoryName: null,
    });
  });

  it("falls back to items when merchant memory is hidden", () => {
    expect(
      resolveCategorySuggestion(
        { merchantMemory: "Groceries", largestItemCategory: "Dining" },
        { hiddenCategoryNames: new Set(["Groceries"]) },
      ),
    ).toEqual({ source: "items", categoryName: "Dining" });
  });

  it("returns null when merchant memory and items are both hidden", () => {
    expect(
      resolveCategorySuggestion(
        { merchantMemory: "Groceries", largestItemCategory: "Dining" },
        { hiddenCategoryNames: new Set(["Groceries", "Dining"]) },
      ),
    ).toEqual({ source: null, categoryName: null });
  });

  it("skips merchant memory not in the available category set", () => {
    expect(
      resolveCategorySuggestion(
        { merchantMemory: "Old Category", largestItemCategory: "Dining" },
        { availableCategoryNames: new Set(["Dining", "Groceries"]) },
      ),
    ).toEqual({ source: "items", categoryName: "Dining" });
  });

  it("ignores item suggestion not in the available set", () => {
    expect(
      resolveCategorySuggestion(
        { merchantMemory: null, largestItemCategory: "Ghost" },
        { availableCategoryNames: new Set(["Dining"]) },
      ),
    ).toEqual({ source: null, categoryName: null });
  });
});
