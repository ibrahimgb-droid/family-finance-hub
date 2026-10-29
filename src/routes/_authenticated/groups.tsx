import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupsQuery } from "@/lib/group-queries";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCY_DIGITS } from "@/domain/money";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({ meta: [{ title: "Groups — Personal Finance App" }, { name: "description", content: "Manage shared spending with your families and friends." }, { property: "og:title", content: "Groups — Personal Finance App" }, { property: "og:description", content: "Your shared expenses, family groups and settlements." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(groupsQuery),
  component: GroupsLayout,
});
function GroupsLayout() {
  const match = useMatchRoute();
  return <>{match({ to: "/groups", fuzzy: false }) ? <Groups /> : null}<Outlet /></>;
}
function Groups() {
  const { data } = useSuspenseQuery(groupsQuery);
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  async function run(action: () => Promise<void>) {
    setPending(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again"); } finally { setPending(false); }
  }
  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-8">
    <Button asChild variant="ghost" size="sm"><Link to="/ledger"><ArrowLeft /> My spending</Link></Button>
    <div className="mt-6 flex items-center gap-3"><Users className="text-primary" /><h1 className="text-3xl">Your groups</h1></div>
    <ul className="mt-6 divide-y divide-border">
      {data.map(g => <li key={g.id}><Link to="/groups/$groupId" params={{ groupId: g.id }} className="flex items-center justify-between gap-3 py-5"><div><p className="font-semibold">{g.name}</p><p className="text-sm text-muted-foreground">{g.base_currency}</p></div><ArrowRight className="size-5 text-primary" /></Link></li>)}
      {!data.length && <li className="py-6 text-muted-foreground">No groups yet.</li>}
    </ul>
    <form className="mt-8 space-y-3 border-t border-border pt-6" onSubmit={e => { e.preventDefault(); run(async () => {
      const { data: g, error } = await supabase.from("groups").insert({ name: name.trim(), base_currency: currency, created_by: user.id }).select("id").single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["groups"] });
      navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
    }); }}>
      <h2 className="text-xl">Create a group</h2>
      <label className="block text-sm">Group name<Input aria-label="Group name" required maxLength={60} value={name} onChange={e => setName(e.target.value)} className="mt-1" /></label>
      <label className="block text-sm">Currency<select aria-label="Group currency" value={currency} onChange={e => setCurrency(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3">{Object.keys(CURRENCY_DIGITS).map(c => <option key={c}>{c}</option>)}</select></label>
      <Button disabled={pending}><Plus /> Create group</Button>
    </form>
    <form className="mt-8 space-y-3 border-t border-border pt-6" onSubmit={e => { e.preventDefault(); run(async () => {
      let value = token.trim();
      if (value.includes("://")) value = new URL(value).searchParams.get("token") ?? "";
      const { data: id, error } = await supabase.rpc("accept_invitation", { _token: value });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["groups"] });
      navigate({ to: "/groups/$groupId", params: { groupId: id } });
    }); }}>
      <h2 className="text-xl">Join a group</h2><Input aria-label="Invitation link or code" placeholder="Invitation link or code" required value={token} onChange={e => setToken(e.target.value)} />
      <Button variant="outline" disabled={pending}>Accept invitation</Button>
    </form>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </main>;
}