// Pure account balance maths in integer minor units.
// Transfers and income have defaults, so two-argument callers keep working.
export const ACCOUNT_KINDS = [
  "checking", "savings", "credit_card", "cash", "investment", "loan_lent", "loan_borrowed",
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  checking: "Current", savings: "Savings", credit_card: "Credit card", cash: "Cash", investment: "Investment",
  loan_lent: "Money I lent", loan_borrowed: "Money I borrowed",
};

export const LOAN_KINDS = ["loan_lent", "loan_borrowed"] as const;
export const isLoan = (kind: AccountKind): boolean => kind === "loan_lent" || kind === "loan_borrowed";

/**
 * Debt accounts: the opening balance is the amount OWED, entered positive, and the
 * balance is shown negative. Must match the CASE in the account_balances SQL view.
 */
export const isDebtKind = (kind: AccountKind): boolean => kind === "credit_card" || kind === "loan_borrowed";

/** Loans track who owes whom; they are not places you spend from. */
export const canSpendFrom = (kind: AccountKind): boolean => !isLoan(kind);

export type AccountInput = { id: string; kind: AccountKind; currency: string; opening_balance_minor: bigint; is_archived?: boolean };
export type AccountTx = { account_id: string | null; status: string; currency: string; total_minor: bigint };
export type AccountIncome = { account_id: string; currency: string; amount_minor: bigint };
export type AccountTransfer = { from_account_id: string; to_account_id: string; from_amount_minor: bigint; to_amount_minor: bigint };

/**
 * Balance = signed opening balance
 *           - confirmed spending in the account's currency
 *           + income received in the account's currency
 *           - transfers out + transfers in.
 * Debt accounts (credit card, money borrowed) start from -opening, so debt is negative.
 * Transfers carry an amount on each side, so cross-currency moves need no rate here.
 */
export function accountBalance(
  account: AccountInput,
  txs: AccountTx[],
  transfers: AccountTransfer[] = [],
  income: AccountIncome[] = [],
): bigint {
  let balance = isDebtKind(account.kind) ? -account.opening_balance_minor : account.opening_balance_minor;
  for (const t of txs) {
    if (t.account_id === account.id && t.status === "confirmed" && t.currency === account.currency) balance -= t.total_minor;
  }
  for (const i of income) {
    if (i.account_id === account.id && i.currency === account.currency) balance += i.amount_minor;
  }
  for (const x of transfers) {
    if (x.from_account_id === account.id) balance -= x.from_amount_minor;
    if (x.to_account_id === account.id) balance += x.to_amount_minor;
  }
  return balance;
}

/** Net worth per currency over active accounts (no FX conversion). Debts reduce it. */
export function netWorthByCurrency(
  accounts: AccountInput[],
  txs: AccountTx[],
  transfers: AccountTransfer[] = [],
  income: AccountIncome[] = [],
): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const a of accounts) {
    if (a.is_archived) continue;
    out.set(a.currency, (out.get(a.currency) ?? 0n) + accountBalance(a, txs, transfers, income));
  }
  return out;
}

/** Amount still owed on a debt account (card or borrowed loan); 0 for anything else or when settled. */
export function amountOwed(kind: AccountKind, balance: bigint): bigint {
  return isDebtKind(kind) && balance < 0n ? -balance : 0n;
}

export type TransferAccount = Pick<AccountInput, "id" | "currency" | "is_archived">;
export type TransferError =
  | "same_account"
  | "amount_not_positive"
  | "account_archived"
  | "same_currency_amounts_differ";

/**
 * Mirrors the database rules on account_transfers (different accounts, positive amounts,
 * equal amounts when the currencies match) and adds the archived-account check, which
 * only the app enforces. Returns null when the transfer is valid.
 */
export function validateTransfer(
  from: TransferAccount,
  to: TransferAccount,
  fromAmountMinor: bigint,
  toAmountMinor: bigint,
): TransferError | null {
  if (from.id === to.id) return "same_account";
  if (fromAmountMinor <= 0n || toAmountMinor <= 0n) return "amount_not_positive";
  if (from.is_archived || to.is_archived) return "account_archived";
  if (from.currency === to.currency && fromAmountMinor !== toAmountMinor) return "same_currency_amounts_differ";
  return null;
}

/** Row for account_transfers. Amounts go over the wire as strings so bigint never loses precision. */
export function toTransferInsert(args: {
  fromId: string;
  toId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  occurredOn: string; // YYYY-MM-DD
  note?: string | null;
}) {
  const note = args.note?.trim();
  return {
    from_account_id: args.fromId,
    to_account_id: args.toId,
    from_amount_minor: args.fromAmountMinor.toString(),
    to_amount_minor: args.toAmountMinor.toString(),
    occurred_on: args.occurredOn,
    note: note ? note.slice(0, 200) : null,
  };
}
