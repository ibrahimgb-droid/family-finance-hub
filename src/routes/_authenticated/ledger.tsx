import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseToMinor, formatMinor, CURRENCY_DIGITS } from "@/domain/money";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => ({
    meta: [
      { title: "My spending — Personal Finance App" },
      { name: "description", content: "Your confirmed expenses and drafts awaiting review." },
      { property: "og:title", content: "My spending — Personal Finance App" },
      { property: "og:description", content: "Your personal expense ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ledger,
});

type Tx = { id: string; merchant: string | null; occurred_on: string; currency: string; total_minor: number | string; status: string };

function Ledger() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);

  const txs = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("id, merchant, occurred_on, currency, total_minor, status")
        .neq("status", "void").order("occurred_on", { ascending: false }).limit(100);
      if (error) throw error;
      return data as Tx[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const minor = parseToMinor(amount, currency);
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id, merchant: merchant.trim() || null, occurred_on: date, currency,
        total_minor: minor.toString() as unknown as number, status: "confirmed",
        confirmed_at: new Date().toISOString(), source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => { setMerchant(""); setAmount(""); setErr(null); qc.invalidateQueries({ queryKey: ["transactions"] }); },
    onError: (e) => setErr((e as Error).message),
  });

  // Summaries count confirmed rows only, grouped per currency (no FX).
  const totals = new Map<string, bigint>();
  for (const t of txs.data ?? []) if (t.status === "confirmed")
    totals.set(t.currency, (totals.get(t.currency) ?? 0n) + BigInt(t.total_minor));
  const drafts = (txs.data ?? []).filter((t) => t.status === "draft").length;

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">My spending</p>
        <button onClick={signOut} className="text-sm text-muted-foreground underline">Sign out</button>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>

      <section className="mt-5 rounded-2xl bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">Confirmed total</p>
        {totals.size === 0 ? <p className="font-display text-3xl">—</p> :
          [...totals].map(([c, v]) => <p key={c} className="font-display text-3xl">{formatMinor(v, c)}</p>)}
        {drafts > 0 && <p className="mt-2 text-sm text-primary">{drafts} draft{drafts > 1 ? "s" : ""} waiting for review</p>}
      </section>

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mt-5 space-y-3 rounded-2xl bg-card p-5 shadow-sm">
        <p className="font-semibold">Add an expense</p>
        <input placeholder="Where? (e.g. Lulu Hypermarket)" value={merchant} maxLength={120} onChange={(e) => setMerchant(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3" />
        <div className="flex gap-2">
          <input required inputMode="decimal" placeholder="0.000" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 font-display text-lg" />
          <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="rounded-xl border border-input bg-background px-3">
            {Object.keys(CURRENCY_DIGITS).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3" />
        <button disabled={add.isPending} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
          Save expense
        </button>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </form>

      <ul className="mt-5 divide-y divide-border rounded-2xl bg-card px-5 shadow-sm">
        {txs.isLoading && <li className="py-4 text-sm text-muted-foreground">Loading…</li>}
        {txs.data?.length === 0 && <li className="py-4 text-sm text-muted-foreground">No expenses yet.</li>}
        {txs.data?.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-semibold">{t.merchant ?? "Expense"}</p>
              <p className="text-xs text-muted-foreground">{t.occurred_on}{t.status === "draft" ? " · draft" : ""}</p>
            </div>
            <span className="font-display">{formatMinor(BigInt(t.total_minor), t.currency)}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
