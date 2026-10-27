import { describe, it, expect } from "vitest";
import {
  allocateLargestRemainder, splitEqual, splitByPercentage, splitFixed, splitByShares,
  splitByMemberCount, splitByWeightedFamily, computeBalances, settlementStatus, SplitError,
} from "./split";
import { parseToMinor, formatMinor } from "./money";

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

describe("money", () => {
  it("parses KWD with 3 decimals", () => expect(parseToMinor("10.005", "KWD")).toBe(10005n));
  it("rejects 3 decimals for SAR", () => expect(() => parseToMinor("1.005", "SAR")).toThrow());
  it("formats KWD", () => expect(formatMinor(1005n, "KWD")).toBe("1.005 KWD"));
});

describe("largest remainder", () => {
  it("10.000 KWD / 3 = 3.334, 3.333, 3.333", () =>
    expect(splitEqual(10000n, 3)).toEqual([3334n, 3333n, 3333n]));
  it("is deterministic on ties (first index wins)", () =>
    expect(allocateLargestRemainder(1n, [1n, 1n])).toEqual([1n, 0n]));
  it("always sums to total", () => {
    for (let t = 0n; t < 500n; t += 7n) expect(sum(allocateLargestRemainder(t, [3n, 5n, 11n]))).toBe(t);
  });
  it("rejects zero total weight", () => expect(() => allocateLargestRemainder(5n, [0n, 0n])).toThrow(SplitError));
});

describe("methods", () => {
  it("percentage 33.33/33.33/33.34 on 1.000 KWD", () =>
    expect(splitByPercentage(1000n, [3333, 3333, 3334])).toEqual([333n, 333n, 334n]));
  it("percentage must total 100%", () => expect(() => splitByPercentage(100n, [5000, 4000])).toThrow());
  it("fixed must equal total", () => expect(() => splitFixed(100n, [40n, 50n])).toThrow());
  it("shares 2:1", () => expect(splitByShares(900n, [2, 1])).toEqual([600n, 300n]));
});

describe("family rules", () => {
  const units = [
    { id: "A", members: [
      { id: "a1", weightMilli: 1000, included: true },
      { id: "a2", weightMilli: 500, included: true },
      { id: "a3", weightMilli: 1000, included: false } ] },
    { id: "B", members: [{ id: "b1", weightMilli: 1000, included: true }] },
  ];
  it("member-count: A=2 of 3 included", () => {
    const r = splitByMemberCount(9000n, units);
    expect(r.map((x) => x.amountMinor)).toEqual([6000n, 3000n]);
    expect(r.map((x) => x.countSnapshot)).toEqual([2, 1]);
  });
  it("weighted: A=1.5 vs B=1.0 of 10.000 KWD", () => {
    const r = splitByWeightedFamily(10000n, units);
    expect(r.map((x) => x.amountMinor)).toEqual([6000n, 4000n]);
    expect(r.map((x) => x.weightSnapshotMilli)).toEqual([1500n, 1000n]);
  });
  it("rejects negative weights", () => expect(() =>
    splitByWeightedFamily(1n, [{ id: "X", members: [{ id: "x", weightMilli: -1, included: true }] }])).toThrow());
});

describe("balances", () => {
  it("nets to zero and applies settlements", () => {
    const b = computeBalances(
      [{ paidBy: "a", allocations: [{ memberId: "a", amountMinor: 500n }, { memberId: "b", amountMinor: 500n }] }],
      [{ from: "b", to: "a", amountMinor: 200n }]);
    expect(b.get("a")).toBe(300n);
    expect(b.get("b")).toBe(-300n);
  });
  it("partial status", () => expect(settlementStatus(500n, 200n)).toBe("partial"));
  it("settled status", () => expect(settlementStatus(500n, 500n)).toBe("settled"));
});
