// Pure helpers for receipt extraction. No framework imports.
export const EXTRACTION_SCHEMA_VERSION = "receipt.v1";

/** Mask card-number-like runs (13–19 digits, spaces/dashes allowed), keeping the last 4. */
export function scrubPan(text: string): string {
  return text.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => {
    const digits = m.replace(/\D/g, "");
    return "•".repeat(digits.length - 4) + digits.slice(-4);
  });
}

/** Normalise a model-reported decimal amount string to minor units, or null if unusable. */
export function amountToMinor(amount: string | null, digits: number): bigint | null {
  if (!amount) return null;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim().replace(/,/g, ""));
  if (!m) return null;
  const frac = (m[2] ?? "").slice(0, digits).padEnd(digits, "0");
  return BigInt(m[1] + frac);
}
