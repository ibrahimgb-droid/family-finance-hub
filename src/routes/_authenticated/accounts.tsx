import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Archive, ArchiveRestore, Wallet } from "lucide-react";
import { accountsQueryKey, fetchAccounts } from "@/lib/account-queries";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABELS, accountBalance, netWorthByCurrency, type AccountKind } from "@/domain/accounts";
import { CURRENCY_DIGITS, formatMinor, parseToMinor } from "@/domain/money";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts — Personal Finance App" },
      { name: "description", content: "Track balances across your bank accounts, cards and cash." },
      { property: "og:title", content: "Accounts — Personal Finance App" },
      { property: "og:description", content: "Every wallet, card and bank account in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Accounts,
});

const inputClass = "w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm";

function Accounts() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: accountsQueryKey, queryFn: fetchAccounts });
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
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: accountsQueryKey });
  const add = useMutation({
    mutationFn: async () => {
      const minor = parseToMinor(opening || "0", currency);
      const { error } = await supabase.from("accounts").insert({ user_id: user.id, name: name.trim(), kind, currency, opening_balance_minor: minor.toString() as unknown as number });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setOpening(""); setErr(null); refresh(); },
    onError: (e) => setErr(e instanceof Error ? e.message : "Could not add account"),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, is_archived }: { id: string; is_archived: boolean }) => {
      const { error } = await supabase.from("accounts").update({ is_archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const list = (accounts.data ?? []).map((a) => ({ ...a, opening_balance_minor: BigInt(a.opening_balance_minor) }));
  const t = txs.data ?? [];
  const net = netWorthByCurrency(list, t);

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
        const bal = accountBalance(a, t);
        return <li key={a.id} className={`bento-tile flex items-start justify-between gap-3 p-4 ${a.is_archived ? "opacity-50" : ""}`}>
          <div className="min-w-0">
            <p className="utility-label text-accent">{ACCOUNT_KIND_LABELS[a.kind]}{a.is_archived ? " · Archived" : ""}</p>
            <p className="mt-1 truncate font-bold">{a.name}</p>
            <p className={`mt-2 text-lg font-extrabold ${bal < 0n ? "text-secondary" : ""}`}>{formatMinor(bal, a.currency)}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={a.is_archived ? `Restore ${a.name}` : `Archive ${a.name}`} onClick={() => toggle.mutate({ id: a.id, is_archived: !a.is_archived })}>
            {a.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </Button>
        </li>;
      })}
    </ul>

    <section className="bento-tile mt-6 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Wallet className="size-5 text-primary" /> Add an account</h2>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <input required aria-label="Account name" maxLength={60} placeholder="e.g. NBK current, Cash" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <select aria-label="Account type" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)} className={inputClass}>{ACCOUNT_KINDS.map((k) => <option key={k} value={k}>{ACCOUNT_KIND_LABELS[k]}</option>)}</select>
          <select aria-label="Account currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border border-input bg-background px-3 text-xs">{Object.keys(CURRENCY_DIGITS).map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <label className="block text-xs text-muted-foreground">{kind === "credit_card" ? "Amount currently owed" : "Starting balance"}
          <input aria-label="Starting balance" inputMode="decimal" placeholder="0.000" value={opening} onChange={(e) => setOpening(e.target.value)} className={`${inputClass} mt-2`} /></label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={add.isPending}><Plus className="size-4" /> Add account</Button>
      </form>
    </section>
  </main>;
}
