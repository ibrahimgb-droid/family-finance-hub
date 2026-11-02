import { useState } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatMinor } from "@/domain/money";
import { monthlyTrend, type TrendTx } from "@/domain/spending-trend";

const label = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en", { month: "short", timeZone: "UTC" });

export function SpendingTrendCard({ txs, today }: { txs: TrendTx[]; today: string }) {
  const currencies = [...new Set(txs.filter((t) => t.status === "confirmed").map((t) => t.currency))];
  const [picked, setPicked] = useState<string | null>(null);
  const currency = picked && currencies.includes(picked) ? picked : currencies[0] ?? "KWD";
  const trend = monthlyTrend(txs, currency, today.slice(0, 7), 6);
  const max = trend.months.reduce((a, m) => (m.total > a ? m.total : a), 0n);
  const cur = trend.months[5]!, prev = trend.months[4]!;
  const bp = trend.changeBp;
  const up = bp !== null && bp > 0, down = bp !== null && bp < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = up ? "text-secondary" : down ? "text-primary" : "text-muted-foreground";

  return (
    <article className="bento-tile col-span-2 flex flex-col bg-card p-5 md:col-span-4 md:p-6" aria-label="Spending trend">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="utility-label text-muted-foreground">SPENDING TREND · 6 MONTHS</p>
        {currencies.length > 1 && <div className="flex gap-2" role="group" aria-label="Trend currency">{currencies.map((c) => <button key={c} type="button" aria-pressed={c === currency} onClick={() => setPicked(c)} className={`rounded-full border px-3 py-1 text-xs font-bold ${c === currency ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground"}`}>{c}</button>)}</div>}
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="font-display text-4xl font-bold md:text-5xl">{formatMinor(cur.total, currency).split(" ")[0]} <span className="text-base font-medium text-muted-foreground">{currency}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{label(cur.month)} so far</p>
          <div className={`mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-bold ${tone}`}>
            <Icon className="size-4" />
            {bp === null ? "No spend last month" : `${up ? "+" : ""}${(bp / 100).toFixed(1)}% vs ${label(prev.month)}`}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{label(prev.month)}: {formatMinor(prev.total, currency)}</p>
        </div>
        <div className="flex h-36 items-end gap-2" role="list">
          {trend.months.map((m, i) => {
            const pct = max === 0n ? 0 : Number((m.total * 100n) / max);
            const last = i === 5;
            return (
              <div key={m.month} role="listitem" className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={formatMinor(m.total, currency)}>
                <div className={`w-full rounded-t-lg ${last ? "bg-primary shadow-[0_0_18px_var(--color-primary)]" : i === 4 ? "bg-accent/70" : "bg-secondary/40"}`} style={{ height: `${Math.max(pct, 3)}%` }} />
                <span className={`text-[11px] ${last ? "font-bold text-primary" : "text-muted-foreground"}`}>{label(m.month)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
