import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { splitByWeightedFamily, splitByMemberCount, type FamilyUnit } from "@/domain/split";
import { parseToMinor, formatMinor, CURRENCY_DIGITS } from "@/domain/money";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Personal Finance App — Fair family splits" },
      { name: "description", content: "Track spending and split shared costs between GCC families with exact, KWD-aware rounding." },
      { property: "og:title", content: "Personal Finance App — Fair family splits" },
      { property: "og:description", content: "Track spending and split shared costs between families with exact rounding." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const families: FamilyUnit[] = [
  { id: "Al-Sabah", members: [
    { id: "1", weightMilli: 1000, included: true }, { id: "2", weightMilli: 1000, included: true },
    { id: "3", weightMilli: 500, included: true } ] },
  { id: "Haddad", members: [{ id: "4", weightMilli: 1000, included: true }, { id: "5", weightMilli: 1000, included: true }] },
  { id: "Nasser", members: [{ id: "6", weightMilli: 1000, included: true }] },
];

function Index() {
  const [amount, setAmount] = useState("47.250");
  const [currency, setCurrency] = useState("KWD");
  const [weighted, setWeighted] = useState(true);

  const result = useMemo(() => {
    try {
      const total = parseToMinor(amount, currency);
      const rows = weighted ? splitByWeightedFamily(total, families) : splitByMemberCount(total, families);
      return { rows, total };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [amount, currency, weighted]);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Personal Finance App</p>
      <h1 className="mt-2 text-4xl leading-tight">Split the dinner bill fairly, to the last fils.</h1>
      <p className="mt-3 text-muted-foreground">Try the split engine: three families, a child counted as half.</p>
      <Link to="/ledger" className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
        Track my spending
      </Link>

      <section className="mt-8 rounded-2xl bg-card p-5 shadow-sm">
        <label className="text-sm text-muted-foreground" htmlFor="amt">Total</label>
        <div className="mt-1 flex gap-2">
          <input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-2xl font-display" />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency"
            className="rounded-xl border border-input bg-background px-3">
            {Object.keys(CURRENCY_DIGITS).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 text-sm font-semibold">
          {[["Weighted", true], ["Head count", false]].map(([l, v]) => (
            <button key={String(l)} onClick={() => setWeighted(v as boolean)}
              className={`rounded-lg py-2 ${weighted === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {l as string}
            </button>
          ))}
        </div>

        {"error" in result ? (
          <p className="mt-4 text-sm text-destructive">{result.error}</p>
        ) : (
          <ul className="mt-5 divide-y divide-border">
            {result.rows!.map((r) => (
              <li key={r.familyUnitId} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold">{r.familyUnitId}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.countSnapshot} people · weight {(Number(r.weightSnapshotMilli) / 1000).toFixed(1)}
                  </p>
                </div>
                <span className="font-display text-lg">{formatMinor(r.amountMinor, currency)}</span>
              </li>
            ))}
            <li className="flex justify-between pt-3 text-sm text-muted-foreground">
              <span>Adds up exactly</span>
              <span>{formatMinor(result.rows!.reduce((s, r) => s + r.amountMinor, 0n), currency)}</span>
            </li>
          </ul>
        )}
      </section>
    </main>
  );
}
