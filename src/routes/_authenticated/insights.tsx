import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Search, ReceiptText } from "lucide-react";
import { insightsQuery } from "@/lib/insight-queries";
import { formatMinor } from "@/domain/money";
import { formatPricePercent } from "@/domain/price-insights";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [
    { title: "Item price insights — Personal Finance App" },
    { name: "description", content: "Compare item prices across your confirmed receipts and see increases and decreases." },
    { property: "og:title", content: "Item price insights — Personal Finance App" },
    { property: "og:description", content: "Your receipt item price changes and purchase history." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(insightsQuery(context.user.id)),
  pendingComponent: () => <main className="mx-auto max-w-2xl p-5 py-8 text-muted-foreground">Loading insights…</main>,
  errorComponent: ({ error, reset }) => <main className="mx-auto max-w-2xl p-5 py-8"><h1 className="text-3xl">Insights unavailable</h1><p className="my-4 text-destructive">{error.message}</p><Button onClick={reset}>Try again</Button><Button asChild variant="ghost"><Link to="/ledger">My spending</Link></Button></main>,
  component: Insights,
});

function Insights() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQuery(insightsQuery(user.id));
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("all");
  const currencies = [...new Set(data.changes.map((item) => item.currency))];
  const increases = data.changes.filter((item) => item.change > 0n).length;
  const decreases = data.changes.length - increases;
  const visible = data.changes.filter((item) =>
    (filter === "all" || (filter === "up" ? item.change > 0n : item.change < 0n)) &&
    (currency === "all" || item.currency === currency) &&
    item.description.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-8">
    <Button asChild variant="ghost" size="sm" className="-ml-3"><Link to="/ledger"><ArrowLeft /> My spending</Link></Button>
    <h1 className="mt-5 text-3xl">Price insights</h1>
    <p className="mt-2 text-sm text-muted-foreground">Latest purchase vs. previous purchase · Confirmed receipts</p>
    <section aria-label="Price change summary" className="mt-6 grid grid-cols-3 gap-3 border-y border-border py-5">
      <div><p className="font-display text-3xl">{data.trackedItems}</p><p className="mt-1 text-xs text-muted-foreground">Items tracked</p></div>
      <div><p className="font-display text-3xl text-destructive">{increases}</p><p className="mt-1 text-xs text-muted-foreground">Price increases</p></div>
      <div><p className="font-display text-3xl text-primary">{decreases}</p><p className="mt-1 text-xs text-muted-foreground">Price decreases</p></div>
    </section>
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Price change filter">
      {[["all", "All changes"], ["up", "Increases"], ["down", "Decreases"]].map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value ?? "all")}>{label}</Button>)}
    </div>
    <div className="mt-3 flex gap-2">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label="Search items" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm" /></div>
      {currencies.length > 1 && <select aria-label="Filter currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-input bg-background px-2 text-sm"><option value="all">All currencies</option>{currencies.map((code) => <option key={code}>{code}</option>)}</select>}
    </div>
    {visible.length === 0 ? <section className="py-12 text-center"><ReceiptText className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-xl">{data.changes.length ? "No matching changes" : "No price changes yet"}</h2><p className="mt-2 text-sm text-muted-foreground">{data.changes.length ? "No items match the selected filters." : "No comparable price changes were found in your confirmed receipts."}</p></section> :
      <ul className="mt-5 space-y-4">
        {visible.map((item) => <li key={item.key} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{item.description}</h2><p className="mt-1 text-xs text-muted-foreground">{item.category} · Unit price</p></div>
            <span className={`flex shrink-0 items-center gap-1 text-sm font-semibold ${item.change > 0n ? "text-destructive" : "text-primary"}`}>{item.change > 0n ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{formatPricePercent(item.change, item.previous.price)}</span>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0"><p className="text-xs text-muted-foreground">Previous</p><p className="mt-1 break-words font-semibold">{formatMinor(item.previous.price, item.currency)}</p></div><ArrowRight className="size-4 text-muted-foreground" />
            <div className="min-w-0 text-right"><p className="text-xs text-muted-foreground">Latest</p><p className="mt-1 break-words font-semibold">{formatMinor(item.latest.price, item.currency)}</p></div>
          </div>
          <p className={`mt-3 text-sm ${item.change > 0n ? "text-destructive" : "text-primary"}`}>{item.change > 0n ? "+" : "−"}{formatMinor(item.change < 0n ? -item.change : item.change, item.currency)} per unit</p>
          <details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer text-sm font-semibold">Purchase history ({item.history.length})</summary><ul className="mt-2 divide-y divide-border">{[...item.history].reverse().map((entry) => <li key={entry.receiptId} className="py-2"><Link to="/review/$id" params={{ id: entry.receiptId }} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0"><span className="block break-words">{entry.merchant}</span><span className="text-xs text-muted-foreground">{entry.date}</span></span><span className="shrink-0">{formatMinor(entry.price, item.currency)}</span></Link></li>)}</ul></details>
        </li>)}
      </ul>}
  </main>;
}