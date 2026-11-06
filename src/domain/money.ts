// Integer minor-unit money. Never use floats for stored amounts.
export const CURRENCY_DIGITS: Record<string, number> = {
  KWD: 3, BHD: 3, OMR: 3,
  SAR: 2, AED: 2, QAR: 2, USD: 2, EUR: 2, GBP: 2, INR: 2,
};

export class MoneyError extends Error {}

export function minorDigits(currency: string): number {
  const d = CURRENCY_DIGITS[currency];
  if (d === undefined) throw new MoneyError(`Unsupported currency: ${currency}`);
  return d;
}

/** Parse a user-entered decimal string ("12.345") to minor units without float math. */
export function parseToMinor(input: string, currency: string): bigint {
  const digits = minorDigits(currency);
  const s = input.trim().replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new MoneyError(`Invalid amount: ${input}`);
  const frac = m[2] ?? "";
  if (frac.length > digits) throw new MoneyError(`Too many decimals for ${currency} (max ${digits})`);
  return BigInt(m[1] + frac.padEnd(digits, "0"));
}

export function formatMinor(minor: bigint, currency: string): string {
  const digits = minorDigits(currency);
  const neg = minor < 0n;
  const abs = (neg ? -minor : minor).toString().padStart(digits + 1, "0");
  const int = abs.slice(0, abs.length - digits);
  const frac = digits ? "." + abs.slice(abs.length - digits) : "";
  return `${neg ? "-" : ""}${int}${frac} ${currency}`;
}

/**
 * Exact decimal text -> integer minor units, no floating point.
 * "24.750" with 3 digits (KWD) -> 24750n. Accepts "," or "." as the decimal mark.
 * Returns null for anything ambiguous or invalid (letters, two marks, too many decimals)
 * instead of throwing, so forms can show a validation message.
 */
export function parseMinorUnits(text: string, digits: number): bigint | null {
  const s = text.trim().replace(",", ".");
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const [whole = "", frac = ""] = s.split(".");
  if (frac.length > digits) return null;
  return BigInt((whole + frac.padEnd(digits, "0")) || "0");
}

/** Integer minor units -> plain decimal text without the currency code, e.g. 24750n, 3 -> "24.750". */
export function formatMinorUnits(minor: bigint, digits: number): string {
  const negative = minor < 0n;
  const abs = (negative ? -minor : minor).toString().padStart(digits + 1, "0");
  const cut = abs.length - digits;
  const text = digits === 0 ? abs : `${abs.slice(0, cut)}.${abs.slice(cut)}`;
  return negative ? `-${text}` : text;
}
