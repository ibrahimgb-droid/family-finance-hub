import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { extractReceipt } from "@/lib/receipts.functions";
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

  const extract = useServerFn(extractReceipt);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  async function scan(file: File) {
    setScanErr(null);
    if (file.size > 10 * 1024 * 1024) return setScanErr("That file is over 10 MB.");
    setScanning(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const retain = new Date(); retain.setFullYear(retain.getFullYear() + 2);
      const { data: rec, error } = await supabase.from("receipts").insert({
        user_id: user.id, storage_path: path, mime_type: file.type, byte_size: file.size, retain_until: retain.toISOString(),
      }).select("id").single();
      if (error) throw error;
      const r = await extract({ data: { receiptId: rec.id } });
      if (!r.ok) throw new Error(r.error);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      navigate({ to: "/review/$id", params: { id: r.transactionId } });
    } catch (e) { setScanErr((e as Error).message); }
    finally { setScanning(false); }
  }

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

      <section className="mt-5 rounded-2xl bg-card p-5 shadow-sm">
        <label className={`block w-full cursor-pointer rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground ${scanning ? "opacity-60" : ""}`}>
          {scanning ? "Reading receipt…" : "Scan a receipt"}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only"
            disabled={scanning} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) scan(f); }} />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Photo or PDF, up to 10 MB. You'll check it before it's saved.</p>
        {scanErr && <p className="mt-2 text-sm text-destructive">{scanErr}</p>}
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
          <li key={t.id}>
            <Link to="/review/$id" params={{ id: t.id }} disabled={t.status !== "draft"} className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold">{t.merchant ?? "Expense"}</p>
                <p className="text-xs text-muted-foreground">{t.occurred_on}{t.status === "draft" ? " · draft — tap to review" : ""}</p>
              </div>
              <span className="font-display">{formatMinor(BigInt(t.total_minor), t.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
