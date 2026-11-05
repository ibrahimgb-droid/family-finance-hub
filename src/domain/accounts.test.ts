import { describe, expect, it } from "vitest";
import { accountBalance, netWorthByCurrency, type AccountInput, type AccountTx } from "./accounts";

const bank: AccountInput = { id: "a", kind: "checking", currency: "KWD", opening_balance_minor: 500000n };
const card: AccountInput = { id: "c", kind: "credit_card", currency: "KWD", opening_balance_minor: 100000n };
const txs: AccountTx[] = [
  { account_id: "a", status: "confirmed", currency: "KWD", total_minor: 12345n },
  { account_id: "a", status: "draft", currency: "KWD", total_minor: 99999n },
  { account_id: "c", status: "confirmed", currency: "KWD", total_minor: 5000n },
  { account_id: null, status: "confirmed", currency: "KWD", total_minor: 7000n },
];

describe("accounts", () => {
  it("subtracts only confirmed spending from a bank account, to the fils", () => {
    expect(accountBalance(bank, txs)).toBe(487655n);
  });
  it("shows credit card debt growing with spending as a negative balance", () => {
    expect(accountBalance(card, txs)).toBe(-105000n);
  });
  it("net worth excludes archived accounts", () => {
    const nw = netWorthByCurrency([bank, card, { ...bank, id: "x", is_archived: true }], txs);
    expect(nw.get("KWD")).toBe(382655n);
  });
});
