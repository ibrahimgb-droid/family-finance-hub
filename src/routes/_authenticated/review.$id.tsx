import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseToMinor, formatMinor, CURRENCY_DIGITS } from "@/domain/money";

export const Route = createFileRoute("/_authenticated/review/$id")({
  head: () => ({
    meta: [
      { title: "Review receipt — Personal Finance App" },
      { name: "description", content: "Check what was read from your receipt before saving it." },
      { property: "og:title", content: "Review receipt — Personal Finance App" },
      { property: "og:description", content: "Confirm a scanned receipt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Review,
});

function toDecimal(minor: number | string, cur: string) {
  return formatMinor(BigInt(minor), cur).split(" ")[0] ?? "";
}

function Review() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tx", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*, receipts(storage_path)").eq("id", id).single();
      if (error) throw error;
      let url: string | null = null;
      const path = (data.receipts as { storage_path: string } | null)?.storage_path;
      if (path) url = (await supabase.storage.from("receipts").createSignedUrl(path, 600)).data?.signedUrl ?? null;
      return { tx: data, url };
    },
  });
  const [f, setF] = useState({ merchant: "", date: "", currency: "KWD", total: "", tax: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const t = q.data.tx;
    setF({ merchant: t.merchant ?? "", date: t.occurred_on, currency: t.currency, total: toDecimal(t.total_minor, t.currency), tax: toDecimal(t.tax_minor, t.currency) });
  }, [q.data]);

  async function save(status: "confirmed" | "void") {
    setErr(null);
    try {
      const patch = status === "void" ? { status, confirmed_at: null } : {
        status, confirmed_at: new Date().toISOString(), merchant: f.merchant.trim() || null, occurred_on: f.date, currency: f.currency,
        total_minor: parseToMinor(f.total, f.currency).toString() as unknown as number,
        tax_minor: parseToMinor(f.tax || "0", f.currency).toString() as unknown as number,
      };
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["transactions"] });
      navigate({ to: "/ledger" });
    } catch (e) { setErr((e as Error).message); }
  }

  if (q.isLoading) return <main className="p-6 text-muted-foreground">Loading…</main>;
  if (q.error) return <main className="p-6 text-destructive">Couldn't load this receipt.</main>;
  const done = q.data!.tx.status !== "draft";
  const field = "w-full rounded-xl border border-input bg-background px-4 py-3";

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link to="/ledger" className="text-sm text-muted-foreground underline">← Back</Link>
      <h1 className="mt-3 text-3xl">Check your receipt</h1>
      <p className="mt-1 text-sm text-muted-foreground">Nothing is counted until you confirm.</p>
      {q.data!.url && <img src={q.data!.url} alt="Receipt" className="mt-4 max-h-80 w-full rounded-2xl object-contain bg-muted" />}
      <div className="mt-5 space-y-3 rounded-2xl bg-card p-5 shadow-sm">
        <input className={field} placeholder="Merchant" value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} disabled={done} />
        <input className={field} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} disabled={done} />
        <div className="flex gap-2">
          <input className={field} inputMode="decimal" aria-label="Total" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} disabled={done} />
          <select aria-label="Currency" className="rounded-xl border border-input bg-background px-3" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} disabled={done}>
            {Object.keys(CURRENCY_DIGITS).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <label className="block text-sm text-muted-foreground">Tax / VAT
          <input className={field} inputMode="decimal" value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} disabled={done} />
        </label>
        {done ? <p className="text-sm text-muted-foreground">This receipt is already {q.data!.tx.status}.</p> : (
          <div className="flex gap-2 pt-1">
            <button onClick={() => save("void")} className="flex-1 rounded-xl border border-input py-3 font-semibold">Discard</button>
            <button onClick={() => save("confirmed")} className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground">Confirm</button>
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    </main>
  );
}
