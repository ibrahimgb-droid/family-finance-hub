import { describe, expect, it } from "vitest";
import { groupSplit } from "./group-split";
const people = [
  { id: "a", familyId: "one", included: true, weightMilli: 1000 },
  { id: "b", familyId: "one", included: true, weightMilli: 500 },
  { id: "c", familyId: "two", included: true, weightMilli: 1000 },
];
describe("shared expense splits", () => {
  it("splits 10.000 KWD equally with stable remainder", () => {
    expect(groupSplit(10000n, "KWD", "equal", people, {}).map(p => p.amountMinor)).toEqual([3334n, 3333n, 3333n]);
  });
  it("preserves family count rounding before allocating within families", () => {
    expect(groupSplit(10000n, "KWD", "member_count", people, {}).map(p => p.amountMinor)).toEqual([3334n, 3333n, 3333n]);
  });
  it("uses integer family weights including half-weight children", () => {
    expect(groupSplit(10000n, "KWD", "weighted_family", people, {}).map(p => p.amountMinor)).toEqual([4000n, 2000n, 4000n]);
  });
  it("excludes unchecked people", () => {
    expect(groupSplit(10000n, "KWD", "equal", people.map(p => ({ ...p, included: p.id !== "b" })), {}).map(p => p.memberId)).toEqual(["a", "c"]);
  });
  it("requires percentages to total exactly 100%", () => {
    expect(() => groupSplit(10000n, "KWD", "percentage", people, { a: "20", b: "20", c: "20" })).toThrow("100%");
  });
  it("requires fixed amounts to equal the expense", () => {
    expect(() => groupSplit(10000n, "KWD", "fixed", people, { a: "1", b: "1", c: "1" })).toThrow("equal total");
  });
  it("allocates consumption units exactly", () => {
    expect(groupSplit(10000n, "KWD", "consumption_units", people, { a: "2", b: "1", c: "1" }).map(p => p.amountMinor)).toEqual([5000n, 2500n, 2500n]);
  });
});