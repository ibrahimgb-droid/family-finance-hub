import { describe, expect, it } from "vitest";
import { scrubPan, amountToMinor } from "./receipt";

describe("receipt helpers", () => {
  it("masks a 16-digit card number keeping last 4", () => {
    expect(scrubPan("CARD 4111 1111 1111 1234 OK")).toBe("CARD ••••••••••••1234 OK");
  });
  it("leaves short numbers like totals alone", () => {
    expect(scrubPan("TOTAL 12.350 KWD")).toBe("TOTAL 12.350 KWD");
  });
  it("converts KWD amount to fils", () => {
    expect(amountToMinor("12.35", 3)).toBe(12350n);
  });
  it("rejects garbage amounts", () => {
    expect(amountToMinor("abc", 3)).toBeNull();
  });
});
