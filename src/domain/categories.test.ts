import { describe, expect, it } from "vitest";
import { isCustomCategory, suggestCategoryName, sumByCategory } from "./categories";

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
