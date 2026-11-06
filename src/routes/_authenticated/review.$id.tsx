import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseToMinor, formatMinor, CURRENCY_DIGITS } from "@/domain/money";
import { useServerFn } from "@tanstack/react-start";
import { saveReceiptReview } from "@/lib/receipt-review.functions";
import { ReceiptLineItems, type EditableReceiptItem } from "@/components/receipt-line-items";
import { signedAmountToMinor, type ReceiptItem } from "@/domain/receipt-items";
import { normalizeMerchant, resolveCategorySuggestion, suggestCategoryName } from "@/domain/categories";
import { categoriesQueryKey, fetchCategories } from "@/lib/category-queries";
import { accountsQueryKey, fetchAccounts } from "@/lib/account-queries";
import { canSpendFrom } from "@/domain/accounts";
import { merchantMemoryQueryKey, fetchMerchantMemoryMap, rememberMerchantCategory } from "@/lib/merchant-memory";
import { Button } from "@/components/ui/button";

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
  const saveReview = useServerFn(saveReceiptReview);
  const q = useQuery({
    queryKey: ["tx", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*, receipts(storage_path, mime_type)").eq("id", id).single();
      if (error) throw error;
      let url: string | null = null;
      const path = (data.receipts as { storage_path: string } | null)?.storage_path;
      if (path) url = (await supabase.storage.from("receipts").createSignedUrl(path, 600)).data?.signedUrl ?? null;
      return { tx: data, url };
    },
  });
  const categories = useQuery({ queryKey: categoriesQueryKey, queryFn: fetchCategories });
  const merchantMemory = useQuery({ queryKey: merchantMemoryQueryKey, queryFn: fetchMerchantMemoryMap });
  const [f, setF] = useState({ merchant: "", date: "", currency: "KWD", total: "", tax: "" });
  const accounts = useQuery({ queryKey: accountsQueryKey, queryFn: fetchAccounts });
  const [accountChoice, setAccountChoice] = useState<string | null | undefined>(undefined);
  const [categoryChoice, setCategoryChoice] = useState<string | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<EditableReceiptItem[]>([]);
  const [saving, setSaving] = useState(false);

  const largestItemCategory = suggestCategoryName(items.map((item) => {
    const minor = signedAmountToMinor(item.amount, f.currency);
    return { category: item.category, total: minor === null ? null : BigInt(minor) };
  }));
  const merchantKey = normalizeMerchant(f.merchant);
  const rememberedName = merchantKey ? (merchantMemory.data?.get(merchantKey) ?? null) : null;
  const suggested = resolveCategorySuggestion(
    { merchantMemory: rememberedName, largestItemCategory },
    {
      availableCategoryNames: new Set((categories.data ?? []).map((c) => c.name)),
      hiddenCategoryNames: new Set((categories.data ?? []).filter((c) => c.is_hidden).map((c) => c.name)),
    },
  );
  const suggestedId = suggested.categoryName ? (categories.data ?? []).find((c) => c.name === suggested.categoryName && !c.is_hidden)?.id ?? null : null;
  const categoryId = categoryChoice !== undefined ? categoryChoice : (q.data?.tx.category_id ?? suggestedId);
  useEffect(() => {
    if (!q.data) return;
    const t = q.data.tx;
    setF({ merchant: t.merchant ?? "", date: t.occurred_on, currency: t.currency, total: toDecimal(t.total_minor, t.currency), tax: toDecimal(t.tax_minor, t.currency) });
    const rows = (Array.isArray(t.line_items) ? t.line_items : []) as unknown as ReceiptItem[];
    setItems(rows.map((item) => ({ ...item, unitPrice: item.unit_price_minor === null ? "" : toDecimal(item.unit_price_minor, t.currency), amount: item.total_minor === null ? "" : toDecimal(item.total_minor, t.currency) })));
  }, [q.data]);

  async function save(status: "confirmed" | "void") {
    setErr(null);
    setSaving(true);
    try {
      const reviewed = items.map(({ unitPrice, amount, ...item }) => {
        const unit = signedAmountToMinor(unitPrice, f.currency);
        const total = signedAmountToMinor(amount, f.currency);
        if ((unitPrice.trim() && unit === null) || (amount.trim() && total === null)) throw new Error("Check the line-item amounts and currency precision.");
        return { ...item, unit_price_minor: unit, total_minor: total };
      });
      await saveReview({ data: { id, status, ...f, categoryId: categoryId ?? null, accountId: (accountChoice !== undefined ? accountChoice : q.data?.tx.account_id) ?? null, items: reviewed } });
      if (status === "confirmed" && categoryId && f.merchant.trim()) await rememberMerchantCategory(f.merchant, categoryId);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["price-insights"] });
      qc.invalidateQueries({ queryKey: ["tx", id] });
      qc.invalidateQueries({ queryKey: merchantMemoryQueryKey });
      navigate({ to: "/ledger" });
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  if (q.isLoading) return <main className="p-6 text-muted-foreground">Loading…</main>;
  if (q.error) return <main className="p-6 text-destructive">Couldn't load this receipt.</main>;
  if (!q.data) return <main className="p-6 text-muted-foreground">Receipt unavailable.</main>;
  const done = q.data.tx.status !== "draft";
  const field = "w-full rounded-xl border border-input bg-background px-4 py-3";

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link to="/ledger" className="text-sm text-muted-foreground underline">← Back</Link>
      <h1 className="mt-3 text-3xl">Check your receipt</h1>
      <p className="mt-1 text-sm text-muted-foreground">Nothing is counted until you confirm.</p>
      {q.data.url && (q.data.tx.receipts?.mime_type === "application/pdf" ? <a href={q.data.url} target="_blank" rel="noreferrer" className="mt-4 block text-primary underline">Open receipt PDF</a> : <img src={q.data.url} alt="Receipt" className="mt-4 max-h-80 w-full rounded-2xl object-contain bg-muted" />)}
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
        <label className="block text-sm text-muted-foreground">Paid from
          <select aria-label="Account" className={field} value={(accountChoice !== undefined ? accountChoice : q.data.tx.account_id) ?? ""} onChange={(e) => setAccountChoice(e.target.value || null)} disabled={done}>
            <option value="">No account</option>
            {(accounts.data ?? []).filter((a) => (!a.is_archived && a.currency === f.currency && canSpendFrom(a.kind)) || a.id === q.data.tx.account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block text-sm text-muted-foreground">Category
          <select className={field} value={categoryId ?? ""} onChange={(e) => setCategoryChoice(e.target.value || null)} disabled={done}>
            <option value="">No category</option>
            {(categories.data ?? []).filter((c) => !c.is_hidden || c.id === categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <ReceiptLineItems items={items} currency={f.currency} total={f.total} disabled={done || saving} onChange={setItems} />
        {done ? <p className="text-sm text-muted-foreground">This receipt is already {q.data.tx.status}.</p> : (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" disabled={saving} onClick={() => save("void")} className="flex-1">Discard</Button>
            <Button disabled={saving} onClick={() => save("confirmed")} className="flex-1">{saving ? "Saving…" : "Confirm"}</Button>
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    </main>
  );
}
