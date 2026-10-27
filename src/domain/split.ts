// Deterministic split engine. Pure, side-effect free; shared by web and future Expo client.
export const ENGINE_VERSION = "split-engine/1.0.0";

export class SplitError extends Error {}

/**
 * Largest-remainder allocation of `total` minor units proportional to integer `weights`.
 * Ties on remainder are broken by input order (stable & deterministic).
 * Sum of result always equals total exactly.
 */
export function allocateLargestRemainder(total: bigint, weights: bigint[]): bigint[] {
  if (total < 0n) throw new SplitError("Total must be non-negative");
  if (weights.length === 0) throw new SplitError("No participants");
  if (weights.some((w) => w < 0n)) throw new SplitError("Weights must be non-negative");
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum === 0n) throw new SplitError("Total weight is zero");
  const base = weights.map((w) => (total * w) / sum);
  const rem = weights.map((w, i) => ({ i, r: (total * w) % sum }));
  let left = total - base.reduce((a, b) => a + b, 0n);
  rem.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; left > 0n; k++, left--) base[rem[k].i] += 1n;
  return base;
}

export interface FamilyMember { id: string; weightMilli: number; included: boolean }
export interface FamilyUnit { id: string; members: FamilyMember[] }

export interface UnitAllocation {
  familyUnitId: string;
  amountMinor: bigint;
  countSnapshot: number;
  weightSnapshotMilli: bigint;
}

function assertWeight(w: number) {
  if (!Number.isInteger(w) || w < 0) throw new SplitError("Member weight must be a non-negative integer (milli)");
}

/** total × family included count / total included count */
export function splitByMemberCount(total: bigint, units: FamilyUnit[]): UnitAllocation[] {
  const counts = units.map((u) => u.members.filter((m) => m.included).length);
  const amounts = allocateLargestRemainder(total, counts.map(BigInt));
  return units.map((u, i) => ({
    familyUnitId: u.id, amountMinor: amounts[i], countSnapshot: counts[i],
    weightSnapshotMilli: BigInt(counts[i] * 1000),
  }));
}

/** total × family effective weight / total effective weight */
export function splitByWeightedFamily(total: bigint, units: FamilyUnit[]): UnitAllocation[] {
  const weights = units.map((u) =>
    u.members.filter((m) => m.included).reduce((s, m) => { assertWeight(m.weightMilli); return s + BigInt(m.weightMilli); }, 0n));
  const amounts = allocateLargestRemainder(total, weights);
  return units.map((u, i) => ({
    familyUnitId: u.id, amountMinor: amounts[i],
    countSnapshot: u.members.filter((m) => m.included).length,
    weightSnapshotMilli: weights[i],
  }));
}

export const splitEqual = (total: bigint, n: number) => {
  if (!Number.isInteger(n) || n < 1) throw new SplitError("Need at least one participant");
  return allocateLargestRemainder(total, Array(n).fill(1n));
};

/** Shares or custom consumption units: integer units per participant. */
export function splitByShares(total: bigint, shares: number[]): bigint[] {
  shares.forEach((s) => { if (!Number.isInteger(s) || s < 0) throw new SplitError("Shares must be non-negative integers"); });
  return allocateLargestRemainder(total, shares.map(BigInt));
}

/** Percentages in basis points (100% = 10000). Must sum to exactly 10000. */
export function splitByPercentage(total: bigint, basisPoints: number[]): bigint[] {
  basisPoints.forEach((b) => { if (!Number.isInteger(b) || b < 0) throw new SplitError("Percentages must be non-negative"); });
  const sum = basisPoints.reduce((a, b) => a + b, 0);
  if (sum !== 10000) throw new SplitError(`Percentages must total 100% (got ${sum / 100}%)`);
  return allocateLargestRemainder(total, basisPoints.map(BigInt));
}

/** Fixed amounts must sum exactly to total. */
export function splitFixed(total: bigint, amounts: bigint[]): bigint[] {
  if (amounts.some((a) => a < 0n)) throw new SplitError("Amounts must be non-negative");
  const sum = amounts.reduce((a, b) => a + b, 0n);
  if (sum !== total) throw new SplitError(`Fixed amounts (${sum}) must equal total (${total})`);
  return [...amounts];
}

// ===== Balances & settlements =====
export interface ExpenseLike { paidBy: string; allocations: { memberId: string; amountMinor: bigint }[] }
export interface SettlementLike { from: string; to: string; amountMinor: bigint }

/** Positive = is owed money; negative = owes. Sum is always zero. */
export function computeBalances(expenses: ExpenseLike[], settlements: SettlementLike[]): Map<string, bigint> {
  const b = new Map<string, bigint>();
  const add = (k: string, v: bigint) => b.set(k, (b.get(k) ?? 0n) + v);
  for (const e of expenses) {
    const total = e.allocations.reduce((s, a) => s + a.amountMinor, 0n);
    add(e.paidBy, total);
    for (const a of e.allocations) add(a.memberId, -a.amountMinor);
  }
  for (const s of settlements) { add(s.from, s.amountMinor); add(s.to, -s.amountMinor); }
  return b;
}

export type SettlementStatus = "open" | "partial" | "settled";
export function settlementStatus(owedOriginal: bigint, paid: bigint): SettlementStatus {
  if (paid <= 0n) return "open";
  return paid >= owedOriginal ? "settled" : "partial";
}
