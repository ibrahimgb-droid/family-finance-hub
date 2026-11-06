import { describe, expect, it } from "vitest";
import { formatMinorUnits, parseMinorUnits } from "./money";

describe("parseMinorUnits", () => {
  it("parses KWD (3 digits) and AED (2 digits) exactly", () => {
    expect(parseMinorUnits("24.750", 3)).toBe(24750n);
    expect(parseMinorUnits("24.75", 3)).toBe(24750n);
    expect(parseMinorUnits("24", 3)).toBe(24000n);
    expect(parseMinorUnits("0.1", 2)).toBe(10n);
    expect(parseMinorUnits("19.99", 2)).toBe(1999n);
  });
  it("accepts a comma as the decimal mark and edge shapes", () => {
    expect(parseMinorUnits("3,5", 3)).toBe(3500n);
    expect(parseMinorUnits(".5", 2)).toBe(50n);
    expect(parseMinorUnits("5.", 2)).toBe(500n);
    expect(parseMinorUnits(" 7 ", 0)).toBe(7n);
  });
  it("rejects invalid or over-precise input instead of rounding", () => {
    expect(parseMinorUnits("", 2)).toBeNull();
    expect(parseMinorUnits("abc", 2)).toBeNull();
    expect(parseMinorUnits("1.234", 2)).toBeNull();
    expect(parseMinorUnits("1.5", 0)).toBeNull();
    expect(parseMinorUnits("1,000.50", 2)).toBeNull();
    expect(parseMinorUnits("-5", 2)).toBeNull();
  });
  it("does not lose precision on very large amounts", () => {
    expect(parseMinorUnits("9007199254740993.00", 2)).toBe(900719925474099300n);
  });
});

describe("formatMinorUnits", () => {
  it("formats with the right number of decimals", () => {
    expect(formatMinorUnits(24750n, 3)).toBe("24.750");
    expect(formatMinorUnits(5n, 2)).toBe("0.05");
    expect(formatMinorUnits(7n, 0)).toBe("7");
    expect(formatMinorUnits(-1999n, 2)).toBe("-19.99");
    expect(formatMinorUnits(0n, 3)).toBe("0.000");
  });
  it("round-trips with parseMinorUnits", () => {
    for (const [text, d] of [["12.345", 3], ["0.01", 2], ["100", 0]] as const) {
      expect(formatMinorUnits(parseMinorUnits(text, d)!, d)).toBe(text);
    }
  });
});
