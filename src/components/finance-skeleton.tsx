export function FinanceSkeleton() {
  return <div aria-label="Loading finance data" role="status" className="space-y-4 py-3">
    {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><span className="skeleton-shimmer size-10 rounded-xl bg-muted" /><div className="flex-1 space-y-2"><div className="skeleton-shimmer h-3 w-2/3 rounded-full bg-muted" /><div className="skeleton-shimmer h-2 w-1/3 rounded-full bg-muted" /></div><span className="skeleton-shimmer h-5 w-16 rounded bg-muted" /></div>)}
    <span className="sr-only">Loading…</span>
  </div>;
}