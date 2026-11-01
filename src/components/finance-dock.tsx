import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ChartNoAxesCombined, Users, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinanceDock() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (!["/ledger", "/insights", "/groups", "/review"].some((prefix) => path.startsWith(prefix))) return null;
  return <nav aria-label="Main navigation" className="finance-dock fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/90 p-2 backdrop-blur-xl">
    {[
      { to: "/ledger" as const, icon: LayoutDashboard, label: "Dashboard" },
      { to: "/insights" as const, icon: ChartNoAxesCombined, label: "Insights" },
      { to: "/groups" as const, icon: Users, label: "Groups" },
    ].map(({ to, icon: Icon, label }) => <Button key={to} asChild variant={path.startsWith(to) ? "default" : "ghost"} size="icon" className="size-12 rounded-full" title={label}><Link to={to} aria-label={label} aria-current={path.startsWith(to) ? "page" : undefined}><Icon className="size-5" /></Link></Button>)}
    <span className="mx-1 h-6 w-px bg-border" />
    <Button asChild variant="pink" size="icon" className="size-12 rounded-full" title="Scan a receipt"><Link to="/ledger" hash="scan-receipt" aria-label="Scan a receipt"><ScanLine className="size-5" /></Link></Button>
  </nav>;
}