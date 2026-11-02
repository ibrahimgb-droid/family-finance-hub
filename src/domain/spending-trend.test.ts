import { describe, it, expect } from "vitest";
import { monthlyTrend } from "./spending-trend";

const tx = (d: string, a: number, status = "confirmed", currency = "KWD") => ({ occurred_on: d, total_minor: a, status, currency });

describe("monthlyTrend", () => {
  it("sums confirmed rows per month and computes MoM change", () => {
    const t = monthlyTrend([tx("2026-10-03", 10000), tx("2026-11-01", 12500), tx("2026-11-02", 999, "draft"), tx("2026-11-02", 5, "confirmed", "USD")], "KWD", "2026-11", 3);
    expect(t.months.map((m) => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(t.months[2]!.total).toBe(12500n);
    expect(t.changeBp).toBe(2500);
  });
  it("returns null change when previous month is empty", () => {
    expect(monthlyTrend([tx("2026-01-05", 100)], "KWD", "2026-01", 2).changeBp).toBeNull();
  });
});
