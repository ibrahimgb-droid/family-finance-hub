import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Archive, ArchiveRestore, Wallet, Trash2 } from "lucide-react";
import { accountsQueryKey, accountTransfersQueryKey, fetchAccounts, fetchAccountTransfers } from "@/lib/account-queries";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABELS, accountBalance, amountOwed, canSpendFrom, isDebtKind, isLoan, netWorthByCurrency, toTransferInsert, type AccountKind } from "@/domain/accounts";
import { CURRENCY_DIGITS, formatMinor, parseToMinor } from "@/domain/money";
import { TransferSheet } from "@/components/transfer-sheet";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts — Personal Finance App" },
      { name: "description", content: "Track balances across your bank accounts, cards, loans and cash." },
      { property: "og:title", content: "Accounts — Personal Finance App" },
      { property: "og:description", content: "Every wallet, card, loan and bank account in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Accounts,
});

const inputClass = "w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm";

const OPENING_LABEL: Record<AccountKind, string> = {
  checking: "Starting balance", savings: "Starting balance", cash: "Starting balance", investment: "Starting balance",
  credit_card: "Amount currently owed", loan_borrowed: "Amount you owe", loan_lent: "Amount owed to you",
};

function Accounts() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: accountsQueryKey, queryFn: fetchAccounts });
  const transfers = useQuery({ queryKey: accountTransfersQueryKey, queryFn: fetchAccountTransfers });
  const txs = useQuery({
    queryKey: ["account-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("account_id, status, currency, total_minor").not("account_id", "is", null).eq("status", "confirmed");
      if (error) throw error;
      return data.map((t) => ({ ...t, total_minor: BigInt(t.total_minor) }));
    },
  });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("checking");
  const [currency, setCurrency] = useState("KWD");
  const [opening, setOpening] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [fundFromId, setFundFromId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: accountsQueryKey });
    qc.invalidateQueries({ queryKey: accountTransfersQueryKey });
  };
  const add = useMutation({
    mutationFn: async () => {
      const minor = parseToMinor(opening || "0", currency);
      const funding = fundFromId ? (accounts.data ?? []).find((a) => a.id === fundFromId) : undefined;
      // A loan funded from an existing account is one transfer, not an opening balance:
      // lending sends bank -> loan, borrowing sends loan -> bank.
      const funded = isLoan(kind) && funding && minor > 0n;
      const { data: created, error } = await supabase.from("accounts").insert({
        user_id: user.id, name: name.trim(), kind, currency,
        opening_balance_minor: (funded ? 0n : minor).toString() as unknown as number,
        counterparty: isLoan(kind) && counterparty.trim() ? counterparty.trim() : null,
      }).select("id").single();
      if (error) throw error;
      if (funded && funding) {
        const row = toTransferInsert({
          fromId: kind === "loan_lent" ? funding.id : created.id,
          toId: kind === "loan_lent" ? created.id : funding.id,
          fromAmountMinor: minor, toAmountMinor: minor,
          occurredOn: new Date().toISOString().slice(0, 10),
          note: kind === "loan_lent" ? `Lent to ${counterparty.trim() || name.trim()}` : `Borrowed from ${counterparty.trim() || name.trim()}`,
        });
        const { error: transferError } = await supabase.from("account_transfers").insert({
          ...row,
          from_amount_minor: row.from_amount_minor as unknown as number,
          to_amount_minor: row.to_amount_minor as unknown as number,
        });
        if (transferError) throw transferError;
      }
    },
    onSuccess: () => { setName(""); setOpening(""); setCounterparty(""); setFundFromId(""); setErr(null); refresh(); },
    onError: (e) => setErr(e instanceof Error ? e.message : "Could not add account"),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, is_archived }: { id: string; is_archived: boolean }) => {
      const { error } = await supabase.from("accounts").update({ is_archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const delTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_transfers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const list = (accounts.data ?? []).map((a) => ({ ...a, opening_balance_minor: BigInt(a.opening_balance_minor) }));
  const t = txs.data ?? [];
  const x = (transfers.data ?? []).map((r) => ({ ...r, from_amount_minor: BigInt(r.from_amount_minor), to_amount_minor: BigInt(r.to_amount_minor) }));
  const net = netWorthByCurrency(list, t, x);
  const fundingOptions = list.filter((a) => !a.is_archived && a.currency === currency && canSpendFrom(a.kind));

  return <main className="mx-auto max-w-3xl px-5 py-8">
    <Link to="/ledger" className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="size-4" /> Dashboard</Link>
    <p className="utility-label mt-6 text-primary">Your money, everywhere</p>
    <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">Accounts<span className="text-secondary">.</span></h1>

    <section className="bento-tile mt-6 p-5">
      <p className="utility-label text-muted-foreground">Net worth</p>
      {net.size === 0 ? <p className="mt-2 text-sm text-muted-foreground">Add an account to see your balance.</p> :
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">{[...net].map(([c, v]) => <p key={c} className={`text-2xl font-extrabold ${v < 0n ? "text-secondary" : "text-primary"}`}>{formatMinor(v, c)}</p>)}</div>}
    </section>

    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {accounts.isLoading && <li className="bento-tile skeleton-shimmer h-24" />}
      {list.map((a) => {
        const bal = accountBalance(a, t, x);
        const owed = amountOwed(a.kind, bal);
        return <li key={a.id} className={`bento-tile flex items-start justify-between gap-3 p-4 ${a.is_archived ? "opacity-50" : ""}`}>
          <div className="min-w-0">
            <p className="utility-label text-accent">{ACCOUNT_KIND_LABELS[a.kind]}{a.is_archived ? " · Archived" : ""}</p>
            <p className="mt-1 truncate font-bold">{a.name}</p>
            {a.counterparty && <p className="truncate text-xs text-muted-foreground">with {a.counterparty}</p>}
            <p className={`mt-2 text-lg font-extrabold ${bal < 0n ? "text-secondary" : ""}`}>{formatMinor(bal, a.currency)}</p>
            {owed > 0n && <p className="text-xs text-muted-foreground">still owed: {formatMinor(owed, a.currency)}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label={a.is_archived ? `Restore ${a.name}` : `Archive ${a.name}`} onClick={() => toggle.mutate({ id: a.id, is_archived: !a.is_archived })}>
            {a.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </Button>
        </li>;
      })}
    </ul>

    <TransferSheet accounts={list} />

    <section className="bento-tile mt-6 p-5">
      <h2 className="text-lg font-bold">Recent transfers</h2>
      {x.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No transfers yet. Card payoffs, loan repayments and money moved between accounts show up here.</p> :
        <ul className="mt-3 space-y-2">{x.slice(0, 10).map((r) => {
          const from = list.find((a) => a.id === r.from_account_id);
          const to = list.find((a) => a.id === r.to_account_id);
          const cross = from && to && from.currency !== to.currency;
          return <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <div className="min-w-0 text-sm">
              <p className="truncate font-bold">{from?.name ?? "?"} → {to?.name ?? "?"}</p>
              <p className="text-xs text-muted-foreground">{r.occurred_on}{r.note ? ` · ${r.note}` : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className="text-sm font-extrabold text-primary">
                {formatMinor(r.from_amount_minor, from?.currency ?? "KWD")}{cross && to ? ` → ${formatMinor(r.to_amount_minor, to.currency)}` : ""}
              </p>
              <Button variant="ghost" size="icon" aria-label="Delete transfer" onClick={() => delTransfer.mutate(r.id)}><Trash2 className="size-4" /></Button>
            </div>
          </li>;
        })}</ul>}
    </section>

    <section className="bento-tile mt-6 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Wallet className="size-5 text-primary" /> Add an account</h2>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <input required aria-label="Account name" maxLength={60} placeholder="e.g. NBK current, Cash" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <select aria-label="Account type" value={kind} onChange={(e) => { setKind(e.target.value as AccountKind); setFundFromId(""); }} className={inputClass}>{ACCOUNT_KINDS.map((k) => <option key={k} value={k}>{ACCOUNT_KIND_LABELS[k]}</option>)}</select>
          <select aria-label="Account currency" value={currency} onChange={(e) => { setCurrency(e.target.value); setFundFromId(""); }} className="rounded-xl border border-input bg-background px-3 text-xs">{Object.keys(CURRENCY_DIGITS).map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {isLoan(kind) && <>
          <input aria-label="Who is the loan with" maxLength={80} placeholder={kind === "loan_lent" ? "Who owes you? e.g. Ahmed" : "Who did you borrow from? e.g. Sara"} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className={inputClass} />
          <label className="block text-xs text-muted-foreground">Fund from an account (optional)
            <select aria-label="Fund from account" value={fundFromId} onChange={(e) => setFundFromId(e.target.value)} className={`${inputClass} mt-2`}>
              <option value="">No — record it as an opening balance</option>
              {fundingOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          {fundFromId && <p className="text-xs text-muted-foreground">{kind === "loan_lent" ? "The money leaves that account now and comes back when they repay you." : "The money lands in that account now and leaves again when you repay."}</p>}
        </>}
        <label className="block text-xs text-muted-foreground">{OPENING_LABEL[kind]}
          <input aria-label={OPENING_LABEL[kind]} inputMode="decimal" placeholder="0.000" value={opening} onChange={(e) => setOpening(e.target.value)} className={`${inputClass} mt-2`} /></label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={add.isPending}><Plus className="size-4" /> Add account</Button>
      </form>
    </section>
  </main>;
}
