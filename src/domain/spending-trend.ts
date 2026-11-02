// Pure monthly spending trend over integer minor units. No React/backend imports.
export type TrendTx = { occurred_on: string; currency: string; total_minor: number | string; status: string };
export type MonthPoint = { month: string; total: bigint };
export type Trend = { currency: string; months: MonthPoint[]; changeBp: number | null };

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Last `count` months ending at `currentMonth` (YYYY-MM), confirmed only, one currency. */
export function monthlyTrend(txs: TrendTx[], currency: string, currentMonth: string, count = 6): Trend {
  const keys = Array.from({ length: count }, (_, i) => shiftMonth(currentMonth, i - count + 1));
  const sums = new Map(keys.map((k) => [k, 0n]));
  for (const t of txs) {
    if (t.status !== "confirmed" || t.currency !== currency) continue;
    const k = t.occurred_on.slice(0, 7);
    if (sums.has(k)) sums.set(k, sums.get(k)! + BigInt(t.total_minor));
  }
  const months = keys.map((month) => ({ month, total: sums.get(month)! }));
  const cur = months[count - 1]!.total, prev = months[count - 2]?.total ?? 0n;
  // Change in basis points vs previous month; null when there is no prior spend.
  const changeBp = prev === 0n ? null : Number(((cur - prev) * 10000n) / prev);
  return { currency, months, changeBp };
}
