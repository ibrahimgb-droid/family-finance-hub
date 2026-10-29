import { parseToMinor } from "./money";
import { allocateLargestRemainder, splitByPercentage, splitByShares, splitFixed, SplitError } from "./split";

export type GroupSplitMethod = "equal" | "fixed" | "percentage" | "shares" | "member_count" | "weighted_family" | "consumption_units";
export type SplitParticipant = { id: string; familyId: string; included: boolean; weightMilli: number };

export function groupSplit(total: bigint, currency: string, method: GroupSplitMethod, people: SplitParticipant[], inputs: Record<string, string>) {
  if (total <= 0n) throw new SplitError("Enter an amount above zero");
  const selected = people.filter(p => p.included);
  if (!selected.length) throw new SplitError("Include at least one person");
  const values = selected.map(p => inputs[p.id] ?? "");
  let amounts: bigint[];
  if (method === "fixed") amounts = splitFixed(total, values.map(v => parseToMinor(v || "0", currency)));
  else if (method === "percentage") amounts = splitByPercentage(total, values.map(v => {
    const b = parseToMinor(v || "0", "USD");
    if (b > 10000n) throw new SplitError("Each percentage must be at most 100%");
    return Number(b);
  }));
  else if (method === "shares" || method === "consumption_units") amounts = splitByShares(total, values.map(v => {
    if (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))) throw new SplitError("Enter whole, non-negative units");
    return Number(v);
  }));
  else if (method === "member_count" || method === "weighted_family") {
    const families = [...new Set(selected.map(p => p.familyId))];
    const members = families.map(id => selected.filter(p => p.familyId === id));
    const weights = members.map(ps => ps.map(p => method === "member_count" ? 1n : BigInt(p.weightMilli)));
    const familyAmounts = allocateLargestRemainder(total, weights.map(ws => ws.reduce((s, w) => s + w, 0n)));
    const byId = new Map<string, bigint>();
    members.forEach((ps, i) => {
      const amount = familyAmounts[i];
      const ws = weights[i];
      if (amount === undefined || !ws) throw new SplitError("Missing family allocation");
      const shares = ws.every(w => w === 0n) ? ws.map(() => 0n) : allocateLargestRemainder(amount, ws);
      ps.forEach((p, j) => byId.set(p.id, shares[j] ?? 0n));
    });
    amounts = selected.map(p => byId.get(p.id) ?? 0n);
  } else amounts = allocateLargestRemainder(total, selected.map(() => 1n));
  return selected.map((p, i) => ({ memberId: p.id, amountMinor: amounts[i] ?? 0n }));
}