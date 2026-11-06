import { describe, expect, it } from "vitest";
import {
  accountBalance, amountOwed, canSpendFrom, netWorthByCurrency, toTransferInsert, validateTransfer,
  type AccountInput, type AccountTransfer,
} from "./accounts";

const acct = (over: Partial<AccountInput> & { id: string }): AccountInput => ({
  kind: "checking", currency: "KWD", opening_balance_minor: 0n, ...over,
});
const spend = (account_id: string, total_minor: bigint, currency = "KWD", status = "confirmed") =>
  ({ account_id, status, currency, total_minor });

describe("accountBalance: original behaviour is unchanged", () => {
  it("subtracts confirmed spending only", () => {
    const a = acct({ id: "a", opening_balance_minor: 100000n });
    const txs = [spend("a", 25000n), spend("a", 5000n, "KWD", "draft"), spend("a", 1000n, "KWD", "void")];
    expect(accountBalance(a, txs)).toBe(75000n);
  });
  it("ignores other accounts and other currencies", () => {
    const a = acct({ id: "a", opening_balance_minor: 1000n });
    expect(accountBalance(a, [spend("b", 500n), spend("a", 500n, "AED")])).toBe(1000n);
  });
  it("shows card debt as negative and spending deepens it", () => {
    const card = acct({ id: "c", kind: "credit_card", opening_balance_minor: 50000n });
    expect(accountBalance(card, [])).toBe(-50000n);
    expect(accountBalance(card, [spend("c", 10000n)])).toBe(-60000n);
  });
});

describe("transfers", () => {
  const bank = acct({ id: "bank", opening_balance_minor: 200000n });
  const savings = acct({ id: "sav", kind: "savings" });
  it("moves money between same-currency accounts", () => {
    const t: AccountTransfer[] = [{ from_account_id: "bank", to_account_id: "sav", from_amount_minor: 30000n, to_amount_minor: 30000n }];
    expect(accountBalance(bank, [], t)).toBe(170000n);
    expect(accountBalance(savings, [], t)).toBe(30000n);
  });
  it("cross-currency transfers use each side's own amount", () => {
    const aed = acct({ id: "aed", currency: "AED" });
    const t: AccountTransfer[] = [{ from_account_id: "bank", to_account_id: "aed", from_amount_minor: 10000n, to_amount_minor: 118400n }];
    expect(accountBalance(bank, [], t)).toBe(190000n);
    expect(accountBalance(aed, [], t)).toBe(118400n);
  });
  it("paying a credit card reduces the amount owed", () => {
    const card = acct({ id: "c", kind: "credit_card", opening_balance_minor: 50000n });
    const t: AccountTransfer[] = [{ from_account_id: "bank", to_account_id: "c", from_amount_minor: 20000n, to_amount_minor: 20000n }];
    expect(accountBalance(card, [], t)).toBe(-30000n);
    expect(accountBalance(bank, [], t)).toBe(180000n);
  });
  it("a transfer does not touch spending totals", () => {
    const t: AccountTransfer[] = [{ from_account_id: "bank", to_account_id: "sav", from_amount_minor: 1n, to_amount_minor: 1n }];
    expect(accountBalance(bank, [spend("bank", 5000n)], t)).toBe(194999n);
  });
});

describe("loans", () => {
  const bank = acct({ id: "bank", opening_balance_minor: 100000n });
  it("lending 40 moves it to a positive 'owed to me' account", () => {
    const lent = acct({ id: "l", kind: "loan_lent" });
    const t: AccountTransfer[] = [{ from_account_id: "bank", to_account_id: "l", from_amount_minor: 40000n, to_amount_minor: 40000n }];
    expect(accountBalance(lent, [], t)).toBe(40000n);
    expect(accountBalance(bank, [], t)).toBe(60000n);
  });
  it("being repaid brings the loan back to zero", () => {
    const lent = acct({ id: "l", kind: "loan_lent" });
    const t: AccountTransfer[] = [
      { from_account_id: "bank", to_account_id: "l", from_amount_minor: 40000n, to_amount_minor: 40000n },
      { from_account_id: "l", to_account_id: "bank", from_amount_minor: 40000n, to_amount_minor: 40000n },
    ];
    expect(accountBalance(lent, [], t)).toBe(0n);
    expect(accountBalance(bank, [], t)).toBe(100000n);
  });
  it("borrowing is a negative balance and repaying clears it", () => {
    const borrowed = acct({ id: "b", kind: "loan_borrowed" });
    const borrow: AccountTransfer = { from_account_id: "b", to_account_id: "bank", from_amount_minor: 25000n, to_amount_minor: 25000n };
    const repay: AccountTransfer = { from_account_id: "bank", to_account_id: "b", from_amount_minor: 25000n, to_amount_minor: 25000n };
    expect(accountBalance(borrowed, [], [borrow])).toBe(-25000n);
    expect(accountBalance(bank, [], [borrow])).toBe(125000n);
    expect(accountBalance(borrowed, [], [borrow, repay])).toBe(0n);
  });
  it("an existing debt entered as an opening balance is negative", () => {
    expect(accountBalance(acct({ id: "b", kind: "loan_borrowed", opening_balance_minor: 7000n }), [])).toBe(-7000n);
    expect(accountBalance(acct({ id: "l", kind: "loan_lent", opening_balance_minor: 7000n }), [])).toBe(7000n);
  });
  it("loans are not spending accounts", () => {
    expect(canSpendFrom("loan_lent")).toBe(false);
    expect(canSpendFrom("loan_borrowed")).toBe(false);
    expect(canSpendFrom("credit_card")).toBe(true);
    expect(canSpendFrom("cash")).toBe(true);
  });
});

describe("income", () => {
  it("adds income in the account's currency only", () => {
    const a = acct({ id: "a", opening_balance_minor: 1000n });
    expect(accountBalance(a, [], [], [
      { account_id: "a", currency: "KWD", amount_minor: 500000n },
      { account_id: "a", currency: "AED", amount_minor: 999n },
      { account_id: "other", currency: "KWD", amount_minor: 999n },
    ])).toBe(501000n);
  });
});

describe("netWorthByCurrency", () => {
  it("nets assets against debts per currency and skips archived accounts", () => {
    const accounts = [
      acct({ id: "bank", opening_balance_minor: 100000n }),
      acct({ id: "card", kind: "credit_card", opening_balance_minor: 30000n }),
      acct({ id: "old", opening_balance_minor: 999999n, is_archived: true }),
      acct({ id: "aed", currency: "AED", opening_balance_minor: 5000n }),
    ];
    const nw = netWorthByCurrency(accounts, []);
    expect(nw.get("KWD")).toBe(70000n);
    expect(nw.get("AED")).toBe(5000n);
  });
  it("a transfer between own accounts leaves net worth unchanged", () => {
    const accounts = [acct({ id: "bank", opening_balance_minor: 100000n }), acct({ id: "sav", kind: "savings" })];
    const t: AccountTransfer[] = [{ from_account_id: "bank", to_account_id: "sav", from_amount_minor: 40000n, to_amount_minor: 40000n }];
    expect(netWorthByCurrency(accounts, [], t).get("KWD")).toBe(100000n);
  });
});

describe("amountOwed", () => {
  it("is the positive debt on cards and borrowed loans, else zero", () => {
    expect(amountOwed("credit_card", -30000n)).toBe(30000n);
    expect(amountOwed("loan_borrowed", -500n)).toBe(500n);
    expect(amountOwed("credit_card", 0n)).toBe(0n);
    expect(amountOwed("credit_card", 1200n)).toBe(0n); // overpaid card
    expect(amountOwed("checking", -9999n)).toBe(0n);
    expect(amountOwed("loan_lent", 5000n)).toBe(0n);
  });
});

describe("validateTransfer", () => {
  const a = { id: "a", currency: "KWD" };
  const b = { id: "b", currency: "KWD" };
  const c = { id: "c", currency: "AED" };
  it("accepts valid transfers", () => {
    expect(validateTransfer(a, b, 100n, 100n)).toBeNull();
    expect(validateTransfer(a, c, 100n, 1184n)).toBeNull();
  });
  it("rejects invalid ones", () => {
    expect(validateTransfer(a, a, 100n, 100n)).toBe("same_account");
    expect(validateTransfer(a, b, 0n, 0n)).toBe("amount_not_positive");
    expect(validateTransfer(a, c, 100n, -5n)).toBe("amount_not_positive");
    expect(validateTransfer(a, b, 100n, 101n)).toBe("same_currency_amounts_differ");
    expect(validateTransfer({ ...a, is_archived: true }, b, 100n, 100n)).toBe("account_archived");
  });
});

describe("toTransferInsert", () => {
  it("sends amounts as strings and trims the note", () => {
    const row = toTransferInsert({ fromId: "a", toId: "b", fromAmountMinor: 24750n, toAmountMinor: 24750n, occurredOn: "2026-11-06", note: "  rent share  " });
    expect(row).toEqual({
      from_account_id: "a", to_account_id: "b", from_amount_minor: "24750", to_amount_minor: "24750",
      occurred_on: "2026-11-06", note: "rent share",
    });
  });
  it("turns an empty note into null and caps long notes at 200", () => {
    expect(toTransferInsert({ fromId: "a", toId: "b", fromAmountMinor: 1n, toAmountMinor: 1n, occurredOn: "2026-11-06", note: "   " }).note).toBeNull();
    expect(toTransferInsert({ fromId: "a", toId: "b", fromAmountMinor: 1n, toAmountMinor: 1n, occurredOn: "2026-11-06", note: "x".repeat(300) }).note?.length).toBe(200);
  });
});
