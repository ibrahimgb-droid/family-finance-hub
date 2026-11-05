import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { extractReceipt } from "@/lib/receipts.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseToMinor, formatMinor, CURRENCY_DIGITS } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Plus, ScanLine, Wallet, Sparkles, LogOut, Check, Users, TrendingUp } from "lucide-react";
import { ReceiptStreak } from "@/components/receipt-streak";
import { SpendingTrendCard } from "@/components/spending-trend-card";
import { FinanceSkeleton } from "@/components/finance-skeleton";
import { CategoryBreakdownCard } from "@/components/category-breakdown-card";
import { categoriesQueryKey, fetchCategories } from "@/lib/category-queries";
import { accountsQueryKey, fetchAccounts } from "@/lib/account-queries";
import { merchantMemoryQueryKey, fetchMerchantMemoryMap, rememberMerchantCategory } from "@/lib/merchant-memory";
import { normalizeMerchant, resolveCategorySuggestion } from "@/domain/categories";
import receiptArt from "@/assets/receipt-sculpture.jpg";

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

type Tx = { id: string; merchant: string | null; occurred_on: string; currency: string; total_minor: number | string; status: string; source: string; category_id: string | null; categories: { name: string } | null };

function Ledger() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const fileInput = useRef<HTMLInputElement>(null);
  const [activityFilter, setActivityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formCategory, setFormCategory] = useState("");
  const [formAccount, setFormAccount] = useState("");
  const accounts = useQuery({ queryKey: accountsQueryKey, queryFn: fetchAccounts });
  const [categoryTouched, setCategoryTouched] = useState(false);
  const categories = useQuery({ queryKey: categoriesQueryKey, queryFn: fetchCategories });
  const merchantMemory = useQuery({ queryKey: merchantMemoryQueryKey, queryFn: fetchMerchantMemoryMap });
  const [showAll, setShowAll] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);

  const txs = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("id, merchant, occurred_on, currency, total_minor, status, source, category_id, categories(name)")
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
        confirmed_at: new Date().toISOString(), source: "manual", category_id: formCategory || null, account_id: formAccount || null,
      });
      if (error) throw error;
      if (formCategory && merchant.trim()) await rememberMerchantCategory(merchant, formCategory);
    },
    onSuccess: () => { setMerchant(""); setAmount(""); setFormCategory(""); setCategoryTouched(false); setErr(null); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["account-transactions"] }); qc.invalidateQueries({ queryKey: merchantMemoryQueryKey }); },
    onError: (e) => setErr((e as Error).message),
  });

  useEffect(() => {
    if (categoryTouched) return;
    const key = normalizeMerchant(merchant);
    const rememberedName = key ? (merchantMemory.data?.get(key) ?? null) : null;
    const suggested = resolveCategorySuggestion({ merchantMemory: rememberedName, largestItemCategory: null }, {
      availableCategoryNames: new Set((categories.data ?? []).map((c) => c.name)),
      hiddenCategoryNames: new Set((categories.data ?? []).filter((c) => c.is_hidden).map((c) => c.name)),
    });
    const suggestedId = suggested.categoryName ? (categories.data ?? []).find((c) => c.name === suggested.categoryName)?.id ?? "" : "";
    setFormCategory(suggestedId);
  }, [merchant, merchantMemory.data, categories.data, categoryTouched]);

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

  const confirmed = (txs.data ?? []).filter((tx) => tx.status === "confirmed");
  const activity = (txs.data ?? []).filter((tx) => (activityFilter === "all" || tx.status === activityFilter) && (categoryFilter === "all" || (categoryFilter === "none" ? tx.category_id === null : tx.category_id === categoryFilter)));
  const visibleActivity = showAll ? activity : activity.slice(0, 5);
  const inputClass = "w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-7 md:px-8 md:py-10">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <Link to="/ledger" className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Wallet className="size-5" /></span><span className="text-sm font-extrabold">PERSONAL FINANCE<span className="text-primary"> /</span></span></Link>
        <div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground md:block">{user.email}</span><Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut /></Button></div>
      </header>
      <div className="flex items-end justify-between gap-4 py-7 md:py-9">
        <div><p className="utility-label mb-3 text-muted-foreground">YOUR MONEY. YOUR RULES.</p><h1 className="text-4xl leading-none md:text-5xl">Money moves<span className="text-secondary">.</span></h1><p className="mt-3 text-sm text-muted-foreground">Less guesswork. More main-character energy.</p></div>
        <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary sm:block"><span className="mr-2 inline-block size-1.5 rounded-full bg-primary" /> YOU'RE IN CONTROL</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <article className="bento-tile col-span-2 flex min-h-56 flex-col justify-between bg-card p-5 md:p-6">
          <div className="flex items-center justify-between"><p className="utility-label text-muted-foreground">CONFIRMED SPENDING</p><span className="flex size-8 items-center justify-center rounded-full border border-border"><ArrowUpRight className="size-4 text-primary" /></span></div>
          <div className="my-5">{txs.isLoading ? <FinanceSkeleton /> : totals.size === 0 ? <p className="font-display text-5xl font-bold">0.000 <span className="text-lg text-muted-foreground">KWD</span></p> : [...totals].map(([c, value]) => <p key={c} className="break-all font-display text-4xl font-bold md:text-5xl">{formatMinor(value, c).split(" ")[0]} <span className="text-base font-medium text-muted-foreground">{c}</span></p>)}</div>
          <div className="flex items-center justify-between border-t border-border pt-4"><span className="text-xs text-muted-foreground">Your latest 100 expenses</span><span className="flex items-center gap-1.5 text-xs text-primary"><Check className="size-3.5" /> Confirmed only</span></div>
        </article>
        <article className="bento-tile flex flex-col justify-between bg-accent/10 p-5">
          <Sparkles className="size-5 text-accent" /><div className="my-4"><p className="font-display text-4xl font-bold">{drafts.toString().padStart(2, "0")}</p><p className="mt-2 text-xs text-muted-foreground">Drafts to review</p></div>
          <Button variant="ghost" className="justify-between px-0 text-accent" onClick={() => { setActivityFilter("draft"); document.getElementById("recent-activity")?.scrollIntoView({ behavior: "smooth" }); }}>REVIEW <ArrowUpRight /></Button>
        </article>
        <article className="bento-tile flex flex-col justify-between bg-card p-5">
          <ArrowDownLeft className="size-5 text-primary" /><div className="my-4"><p className="font-display text-4xl font-bold">{confirmed.length.toString().padStart(2, "0")}</p><p className="mt-2 text-xs text-muted-foreground">Expenses logged</p></div><p className="utility-label text-muted-foreground">ONE LESS THING TO GUESS</p>
        </article>

        <article id="scan-receipt" className="bento-tile relative col-span-2 flex min-h-64 flex-col bg-card p-5 md:p-6">
          <div className="relative z-10 max-w-[58%]"><span className="utility-label text-primary">RECEIPTS → REAL CLARITY</span><h2 className="mt-3 text-3xl leading-tight">Scan it.<br />Own it.</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Every item. Every fils.<br />All in one place.</p></div>
          <img src={receiptArt} width={1024} height={1024} alt="Chrome receipt sculpture with a neon pink payment card" className="absolute right-0 top-0 h-full w-[58%] object-cover" />
          <div className="relative z-10 mt-auto pt-5"><Button variant="pink" disabled={scanning} onClick={() => fileInput.current?.click()}><ScanLine />{scanning ? "Reading receipt…" : "Scan a receipt"}</Button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only" disabled={scanning} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) scan(f); }} />
            {scanning && <div className="skeleton-shimmer mt-3 h-1 w-32 rounded-full bg-secondary" />}{scanErr && <p className="mt-2 text-xs text-destructive">{scanErr}</p>}</div>
        </article>
        <div className="col-span-2 md:col-span-2"><ReceiptStreak today={today} dates={confirmed.filter((tx) => tx.source === "receipt").map((tx) => tx.occurred_on)} /></div>
        <SpendingTrendCard txs={txs.data ?? []} today={today} />
        <CategoryBreakdownCard today={today} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.35fr_1fr]">
        <section id="recent-activity" className="min-w-0">
          <div className="flex items-center justify-between"><h2 className="text-xl">The latest</h2><Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : "View all"}<ArrowUpRight /></Button></div>
          <div className="mt-4 flex gap-2" role="group" aria-label="Activity filter">{[["all", "All moves"], ["confirmed", "Confirmed"], ["draft", "Drafts"]].map(([value, label]) => <Button key={value} size="sm" variant={activityFilter === value ? "default" : "outline"} className="rounded-full" aria-pressed={activityFilter === value} onClick={() => setActivityFilter(value ?? "all")}>{label}</Button>)}</div>
          <select aria-label="Category filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"><option value="all">All categories</option><option value="none">Uncategorized</option>{(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <ul className="mt-3 divide-y divide-border">
            {txs.isLoading && <li><FinanceSkeleton /></li>}
            {txs.error && <li className="py-5 text-sm text-destructive">Couldn't load your expenses.</li>}
            {!txs.isLoading && visibleActivity.length === 0 && <li className="py-8 text-sm text-muted-foreground">No {activityFilter === "all" ? "expenses" : activityFilter === "draft" ? "drafts" : "confirmed expenses"} yet.</li>}
            {visibleActivity.map((t, index) => <li key={t.id}><Link to="/review/$id" params={{ id: t.id }} className="group flex items-center gap-3 py-4"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${index % 3 === 0 ? "bg-secondary/10 text-secondary" : index % 3 === 1 ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}><ArrowUpRight className="size-4 transition-transform group-hover:rotate-45" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{t.merchant ?? "Expense"}</p><p className="mt-1 text-[11px] text-muted-foreground">{t.occurred_on}{t.status === "draft" ? " · Draft" : " · Confirmed"}{t.categories ? ` · ${t.categories.name}` : ""}</p></div><span className="shrink-0 text-sm font-bold">{formatMinor(BigInt(t.total_minor), t.currency)}</span></Link></li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/insights"><TrendingUp /> Price insights</Link></Button><Button asChild variant="outline" size="sm"><Link to="/groups"><Users /> Your circle</Link></Button></div>
        </section>
        <section className="min-w-0 border-t border-border pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl">Log a little</h2><Plus className="size-5 text-primary" /></div>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-3">
            <label className="block text-xs text-muted-foreground">Merchant<input aria-label="Merchant" placeholder="Where did it go?" value={merchant} maxLength={120} onChange={(e) => setMerchant(e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="block text-xs text-muted-foreground">Amount<div className="mt-2 flex gap-2"><input required aria-label="Amount" inputMode="decimal" placeholder="0.000" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /><select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border border-input bg-background px-3 text-xs">{Object.keys(CURRENCY_DIGITS).map((c) => <option key={c}>{c}</option>)}</select></div></label>
            <label className="block text-xs text-muted-foreground">Paid from<select aria-label="Account" value={formAccount} onChange={(e) => setFormAccount(e.target.value)} className={`${inputClass} mt-2`}><option value="">No account</option>{(accounts.data ?? []).filter((a) => !a.is_archived && a.currency === currency).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label className="block text-xs text-muted-foreground">Category<select aria-label="Category" value={formCategory} onChange={(e) => { setFormCategory(e.target.value); setCategoryTouched(true); }} className={`${inputClass} mt-2`}><option value="">No category</option>{(categories.data ?? []).filter((c) => !c.is_hidden).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="block text-xs text-muted-foreground">Date<input aria-label="Expense date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-2`} /></label>
            <Button disabled={add.isPending} className="mt-2 w-full"><Plus />{add.isPending ? "Saving…" : "Save expense"}</Button>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
