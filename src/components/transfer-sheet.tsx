import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { accountsQueryKey, accountTransfersQueryKey, type Account } from "@/lib/account-queries";
import { isLoan, toTransferInsert, validateTransfer, type TransferError } from "@/domain/accounts";
import { minorDigits, parseMinorUnits } from "@/domain/money";

const inputClass = "w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm";

const ERROR_TEXT: Record<TransferError, string> = {
  same_account: "Choose two different accounts.",
  amount_not_positive: "Amounts must be greater than zero.",
  account_archived: "Archived accounts can't make transfers.",
  same_currency_amounts_differ: "Both amounts must match when the currency is the same.",
};

/**
 * One row in account_transfers moves money between two of the user's accounts.
 * Same currency: the received amount is locked to the sent amount (the database
 * requires them equal). Cross-currency: the received amount stays editable and
 * no exchange rate is assumed — the KWD is not pegged, so we never pre-fill one.
 */
export function TransferSheet({ accounts }: { accounts: Pick<Account, "id" | "name" | "kind" | "currency" | "is_archived">[] }) {
  const qc = useQueryClient();
  const active = accounts.filter((a) => !a.is_archived);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [toTouched, setToTouched] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const from = active.find((a) => a.id === fromId);
  const to = active.find((a) => a.id === toId);
  const sameCurrency = !!from && !!to && from.currency === to.currency;
  const involvesLoan = !!((from && isLoan(from.kind)) || (to && isLoan(to.kind)));

  const pickFrom = (id: string) => {
    setFromId(id);
    setToTouched(false);
    const next = active.find((a) => a.id === id);
    if (next && to && next.currency === to.currency) setToAmount(fromAmount);
  };
  const pickTo = (id: string) => {
    setToId(id);
    setToTouched(false);
    const next = active.find((a) => a.id === id);
    if (next && from && from.currency === next.currency) setToAmount(fromAmount);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!from || !to) throw new Error("Choose both accounts.");
      const fromMinor = parseMinorUnits(fromAmount, minorDigits(from.currency));
      const toMinor = parseMinorUnits(toAmount, minorDigits(to.currency));
      if (fromMinor === null || toMinor === null) throw new Error("Enter valid amounts (check the number of decimals).");
      const problem = validateTransfer(from, to, fromMinor, toMinor);
      if (problem) throw new Error(ERROR_TEXT[problem]);
      const row = toTransferInsert({ fromId: from.id, toId: to.id, fromAmountMinor: fromMinor, toAmountMinor: toMinor, occurredOn: date, note });
      const { error } = await supabase.from("account_transfers").insert({
        ...row,
        from_amount_minor: row.from_amount_minor as unknown as number,
        to_amount_minor: row.to_amount_minor as unknown as number,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFromAmount(""); setToAmount(""); setToTouched(false); setNote(""); setErr(null);
      qc.invalidateQueries({ queryKey: accountsQueryKey });
      qc.invalidateQueries({ queryKey: accountTransfersQueryKey });
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Could not save the transfer"),
  });

  return (
    <section className="bento-tile mt-6 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><ArrowLeftRight className="size-5 text-secondary" /> Move money</h2>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">From
            <select required aria-label="From account" value={fromId} onChange={(e) => pickFrom(e.target.value)} className={`${inputClass} mt-2`}>
              <option value="" disabled>Choose account</option>
              {active.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">To
            <select required aria-label="To account" value={toId} onChange={(e) => pickTo(e.target.value)} className={`${inputClass} mt-2`}>
              <option value="" disabled>Choose account</option>
              {active.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">Amount sent{from ? ` (${from.currency})` : ""}
            <input required aria-label="Amount sent" inputMode="decimal" placeholder="0.000" value={fromAmount}
              onChange={(e) => { setFromAmount(e.target.value); if (sameCurrency) setToAmount(e.target.value); }} className={`${inputClass} mt-2`} />
          </label>
          <label className="block text-xs text-muted-foreground">Amount received{to ? ` (${to.currency})` : ""}
            <input aria-label="Amount received" inputMode="decimal" placeholder="0.000" value={toAmount}
              onChange={(e) => { setToAmount(e.target.value); setToTouched(true); }}
              readOnly={sameCurrency} required={!sameCurrency}
              className={`${inputClass} mt-2 ${sameCurrency ? "opacity-60" : ""}`} />
          </label>
        </div>
        {from && to && !sameCurrency && <p className="text-xs text-muted-foreground">Different currencies — enter the amount actually received. No exchange rate is assumed.</p>}
        {involvesLoan && <p className="text-xs text-muted-foreground">Loans move like any transfer: lend by sending from your bank to the “Money I lent” account; repayments and borrowing follow the direction the money moves.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">Date
            <input required aria-label="Transfer date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-2`} />
          </label>
          <label className="block text-xs text-muted-foreground">Note (optional)
            <input aria-label="Transfer note" maxLength={200} placeholder="e.g. rent share" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-2`} />
          </label>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={save.isPending}><ArrowLeftRight className="size-4" /> {save.isPending ? "Saving…" : "Save transfer"}</Button>
      </form>
    </section>
  );
}
