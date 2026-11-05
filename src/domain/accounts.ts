// Pure account balance maths in integer minor units.
export const ACCOUNT_KINDS = ["checking", "savings", "credit_card", "cash", "investment"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  checking: "Current", savings: "Savings", credit_card: "Credit card", cash: "Cash", investment: "Investment",
};

export type AccountInput = { id: string; kind: AccountKind; currency: string; opening_balance_minor: bigint; is_archived?: boolean };
export type AccountTx = { account_id: string | null; status: string; currency: string; total_minor: bigint };

/**
 * Balance = opening balance minus confirmed spending in the account's currency.
 * For credit cards the opening balance is the amount owed, and spending increases it,
 * so the returned balance is negative for debt (owed amount shown as a liability).
 */
export function accountBalance(account: AccountInput, txs: AccountTx[]): bigint {
  let spent = 0n;
  for (const t of txs) {
    if (t.account_id === account.id && t.status === "confirmed" && t.currency === account.currency) spent += t.total_minor;
  }
  if (account.kind === "credit_card") return -(account.opening_balance_minor + spent);
  return account.opening_balance_minor - spent;
}

/** Net worth per currency over active accounts (no FX conversion). */
export function netWorthByCurrency(accounts: AccountInput[], txs: AccountTx[]): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const a of accounts) {
    if (a.is_archived) continue;
    out.set(a.currency, (out.get(a.currency) ?? 0n) + accountBalance(a, txs));
  }
  return out;
}
