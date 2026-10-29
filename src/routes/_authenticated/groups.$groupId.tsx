import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Copy, Check, Users, Receipt, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupQuery } from "@/lib/group-queries";
import { createGroupInvitation, saveGroupExpense } from "@/lib/groups.functions";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCY_DIGITS, formatMinor, parseToMinor } from "@/domain/money";
import { groupSplit, type GroupSplitMethod } from "@/domain/group-split";
import { computeBalances } from "@/domain/split";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({ meta: [{ title: "Shared expenses — Personal Finance App" }, { name: "description", content: "Split family expenses and record payments in your private group." }, { property: "og:title", content: "Shared expenses — Personal Finance App" }, { property: "og:description", content: "Family participants, exact expense splits and settlement history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(groupQuery(params.groupId)),
  component: GroupDetail,
});
const methods: [GroupSplitMethod, string][] = [["equal", "Equal"], ["member_count", "Family head count"], ["weighted_family", "Weighted family"], ["fixed", "Fixed amounts"], ["percentage", "Percentages"], ["shares", "Shares"], ["consumption_units", "Consumption units"]];
const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQuery(groupQuery(groupId));
  const qc = useQueryClient();
  const saveExpense = useServerFn(saveGroupExpense);
  const invite = useServerFn(createGroupInvitation);
  const [tab, setTab] = useState<"expenses" | "families" | "settlements">("expenses");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [family, setFamily] = useState("");
  const [person, setPerson] = useState("");
  const [unitId, setUnitId] = useState("");
  const [weight, setWeight] = useState("1000");
  const [inviteMember, setInviteMember] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(data.group?.base_currency ?? "KWD");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payer, setPayer] = useState("");
  const [method, setMethod] = useState<GroupSplitMethod>("equal");
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payment, setPayment] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState(data.group?.base_currency ?? "KWD");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const isAdmin = data.membership.some(m => m.user_id === user.id && m.role !== "member");
  const selectedPeople = data.people.map(p => ({ id: p.id, familyId: p.family_unit_id, weightMilli: p.weight_milli, included: included[p.id] ?? p.included }));
  let preview: ReturnType<typeof groupSplit> = [];
  let splitError = "";
  try { if (amount) preview = groupSplit(parseToMinor(amount, currency), currency, method, selectedPeople, inputs); } catch (e) { splitError = e instanceof Error ? e.message : "Invalid split"; }
  const name = (id: string | null) => data.people.find(p => p.id === id)?.display_name ?? "Family";
  async function run(action: () => Promise<void>) {
    setPending(true); setError(""); setMessage("");
    try { await action(); await qc.invalidateQueries({ queryKey: ["group", groupId] }); } catch (e) { setError(e instanceof Error ? e.message : "Please try again"); } finally { setPending(false); }
  }
  const currencies = [...new Set([data.group?.base_currency ?? "KWD", ...data.expenses.map(e => e.currency), ...data.settlements.map(s => s.currency)])];
  const hasInputs = ["fixed", "percentage", "shares", "consumption_units"].includes(method);
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-8">
    <Button asChild size="sm" variant="ghost"><Link to="/groups"><ArrowLeft /> Groups</Link></Button>
    <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2"><h1 className="break-words text-3xl">{data.group?.name}</h1><span className="text-sm text-muted-foreground">{data.people.length} people · {data.units.length} families</span></div>
    <nav aria-label="Group sections" className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
      <Button variant={tab === "expenses" ? "default" : "ghost"} onClick={() => setTab("expenses")}><Receipt /> Expenses</Button>
      <Button variant={tab === "families" ? "default" : "ghost"} onClick={() => setTab("families")}><Users /> Families</Button>
      <Button variant={tab === "settlements" ? "default" : "ghost"} onClick={() => setTab("settlements")}><ArrowLeftRight /> Settle up</Button>
    </nav>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
    {tab === "families" && <div className="mt-6 space-y-8">
      {data.units.map(u => <section key={u.id}><h2 className="text-xl">{u.name}</h2><ul className="mt-2 divide-y divide-border">{data.people.filter(p => p.family_unit_id === u.id).map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-semibold">{p.display_name}</p><p className="text-xs text-muted-foreground">{p.user_id ? "Account linked" : "Guest"} · weight {p.weight_milli} / 1000</p></div>{isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.included} disabled={pending} onChange={e => { const checked = e.target.checked; run(async () => { const { error } = await supabase.from("family_members").update({ included: checked }).eq("id", p.id); if (error) throw error; }); }} /> Included</label>}</li>)}</ul></section>)}
      {!data.units.length && <p className="text-muted-foreground">No families yet.</p>}
      {isAdmin && <>
        <form className="space-y-3 border-t border-border pt-6" onSubmit={e => { e.preventDefault(); run(async () => { const { error } = await supabase.from("family_units").insert({ group_id: groupId, name: family.trim() }); if (error) throw error; setFamily(""); }); }}><h2 className="text-xl">Add a family</h2><Input aria-label="Family name" required maxLength={60} value={family} onChange={e => setFamily(e.target.value)} /><Button disabled={pending}><Plus /> Add family</Button></form>
        <form className="space-y-3 border-t border-border pt-6" onSubmit={e => { e.preventDefault(); run(async () => { const { error } = await supabase.from("family_members").insert({ group_id: groupId, family_unit_id: unitId, display_name: person.trim(), weight_milli: Number(weight) }); if (error) throw error; setPerson(""); }); }}>
          <h2 className="text-xl">Add a person</h2><label className="block text-sm">Family<select aria-label="Person family" className={selectClass} required value={unitId} onChange={e => setUnitId(e.target.value)}><option value="">Select family</option>{data.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="block text-sm">Name<Input aria-label="Person name" required maxLength={60} value={person} onChange={e => setPerson(e.target.value)} /></label>
          <label className="block text-sm">Weight<select aria-label="Person weight" className={selectClass} value={weight} onChange={e => setWeight(e.target.value)}><option value="1000">Full · 1.0</option><option value="500">Half · 0.5</option><option value="0">Zero · 0.0</option></select></label><Button disabled={pending || !data.units.length}><Plus /> Add person</Button>
        </form>
        <form className="space-y-3 border-t border-border pt-6" onSubmit={e => { e.preventDefault(); run(async () => { const result = await invite({ data: { groupId, memberId: inviteMember, email } }); setLink(`${window.location.origin}/invite?token=${encodeURIComponent(result.token)}`); }); }}><h2 className="text-xl">Invite to group</h2><select aria-label="Invitation person" className={selectClass} required value={inviteMember} onChange={e => setInviteMember(e.target.value)}><option value="">Select guest</option>{data.people.filter(p => !p.user_id).map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select><Input aria-label="Invitation email" type="email" placeholder="Email (optional)" value={email} onChange={e => setEmail(e.target.value)} /><Button disabled={pending}>Create invitation</Button>
          {link && <div className="flex items-center gap-2"><Input aria-label="Share invitation" readOnly value={link} /><Button type="button" variant="outline" size="icon" title="Copy invitation" aria-label="Copy invitation" onClick={() => run(async () => { await navigator.clipboard.writeText(link); setMessage("Invitation copied"); })}><Copy /></Button></div>}
        </form>
        <ul className="divide-y divide-border">{data.invites.map(i => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{name(i.family_member_id)} · {i.email || "Any email"} · {i.status} · {i.expires_at.slice(0, 10)}</span>{i.status === "pending" && <Button variant="outline" size="sm" disabled={pending} onClick={() => run(async () => { const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", i.id); if (error) throw error; })}>Revoke</Button>}</li>)}</ul>
      </>}
    </div>}
    {tab === "expenses" && <div className="mt-6 grid gap-8 md:grid-cols-2">
      <form className="min-w-0 space-y-3" onSubmit={e => { e.preventDefault(); run(async () => { await saveExpense({ data: { groupId, payerId: payer, description, date, currency, amount, method, includedIds: selectedPeople.filter(p => p.included).map(p => p.id), inputs } }); setAmount(""); setDescription(""); setMessage("Expense confirmed"); }); }}>
        <h2 className="text-xl">Add shared expense</h2>
        <label className="block text-sm">Description<Input aria-label="Expense description" required maxLength={120} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-sm">Amount<Input aria-label="Expense amount" inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="min-w-0 text-sm">Currency<select aria-label="Expense currency" className={selectClass} value={currency} onChange={e => setCurrency(e.target.value)}>{Object.keys(CURRENCY_DIGITS).map(c => <option key={c}>{c}</option>)}</select></label></div>
        <label className="block text-sm">Date<Input aria-label="Expense date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="block text-sm">Paid by<select aria-label="Paid by" className={selectClass} required value={payer} onChange={e => setPayer(e.target.value)}><option value="">Select payer</option>{data.people.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
        <label className="block text-sm">Split<select aria-label="Split method" className={selectClass} value={method} onChange={e => setMethod(e.target.value as GroupSplitMethod)}>{methods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <ul className="divide-y divide-border">{data.people.map(p => <li key={p.id} className="flex flex-wrap items-center gap-2 py-3"><label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={included[p.id] ?? p.included} onChange={e => setIncluded({ ...included, [p.id]: e.target.checked })} />{p.display_name}</label>{hasInputs && <Input aria-label={`Split input for ${p.display_name}`} inputMode="decimal" className="w-20" value={inputs[p.id] ?? ""} onChange={e => setInputs({ ...inputs, [p.id]: e.target.value })} placeholder={method === "percentage" ? "%" : "0"} />}<span className="text-sm tabular-nums">{formatMinor(preview.find(a => a.memberId === p.id)?.amountMinor ?? 0n, currency)}</span></li>)}</ul>
        {splitError && <p className="text-sm text-destructive">{splitError}</p>}<Button disabled={pending || !preview.length || !!splitError}><Check /> Confirm expense</Button>
      </form>
      <section className="min-w-0"><h2 className="text-xl">Expense history</h2><ul className="mt-3 divide-y divide-border">{data.expenses.map(e => <li key={e.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><p className="break-words font-semibold">{e.description}</p><span className="font-display">{formatMinor(BigInt(e.total_minor), e.currency)}</span></div><p className="mt-1 text-xs text-muted-foreground">{e.occurred_on} · paid by {name(e.paid_by_member_id)}</p><details className="mt-2 text-sm"><summary className="cursor-pointer text-primary">Split details</summary><ul className="mt-2 space-y-1">{data.allocations.filter(a => a.expense_id === e.id).map(a => <li key={a.id} className="flex justify-between gap-2"><span>{name(a.family_member_id)}</span><span>{formatMinor(BigInt(a.amount_minor), e.currency)}</span></li>)}</ul></details></li>)}{!data.expenses.length && <li className="py-6 text-muted-foreground">No shared expenses yet.</li>}</ul></section>
    </div>}
    {tab === "settlements" && <div className="mt-6 grid gap-8 md:grid-cols-2"><section><h2 className="text-xl">Balances</h2>{currencies.map(c => {
      const balances = computeBalances(data.expenses.filter(e => e.currency === c).map(e => ({ paidBy: e.paid_by_member_id, allocations: data.allocations.filter(a => a.expense_id === e.id && a.family_member_id).map(a => ({ memberId: a.family_member_id ?? "", amountMinor: BigInt(a.amount_minor) })) })), data.settlements.filter(s => s.currency === c).map(s => ({ from: s.from_member_id, to: s.to_member_id, amountMinor: BigInt(s.amount_minor) })));
      return <div key={c} className="mt-4"><p className="text-sm font-semibold text-primary">{c}</p><ul className="divide-y divide-border">{data.people.map(p => { const b = balances.get(p.id) ?? 0n; return <li key={p.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{p.display_name}</span><span>{b === 0n ? "Settled" : `${b > 0n ? "Is owed" : "Owes"} ${formatMinor(b < 0n ? -b : b, c)}`}</span></li>; })}</ul></div>;
    })}<h2 className="mt-8 text-xl">Payment history</h2><ul className="mt-2 divide-y divide-border">{data.settlements.map(s => <li key={s.id} className="py-3 text-sm"><p>{name(s.from_member_id)} → {name(s.to_member_id)}</p><p>{formatMinor(BigInt(s.amount_minor), s.currency)} · {s.settled_on}</p>{s.note && <p className="text-muted-foreground">{s.note}</p>}</li>)}{!data.settlements.length && <li className="py-4 text-muted-foreground">No payments recorded.</li>}</ul></section>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(async () => { if (from === to) throw new Error("Choose two different people"); const minor = parseToMinor(payment, paymentCurrency); if (minor <= 0n) throw new Error("Enter a payment above zero"); const { error } = await supabase.from("settlements").insert({ group_id: groupId, from_member_id: from, to_member_id: to, currency: paymentCurrency, amount_minor: minor.toString() as unknown as number, recorded_by: user.id, settled_on: paymentDate, note: note.trim() || null }); if (error) throw error; setPayment(""); setNote(""); setMessage("Payment recorded"); }); }}><h2 className="text-xl">Record payment</h2>
        <label className="block text-sm">From<select aria-label="Payment from" className={selectClass} required value={from} onChange={e => setFrom(e.target.value)}><option value="">Select person</option>{data.people.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
        <label className="block text-sm">To<select aria-label="Payment to" className={selectClass} required value={to} onChange={e => setTo(e.target.value)}><option value="">Select person</option>{data.people.filter(p => p.id !== from).map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
        <label className="block text-sm">Amount<Input aria-label="Payment amount" inputMode="decimal" required value={payment} onChange={e => setPayment(e.target.value)} /></label>
        <label className="block text-sm">Currency<select aria-label="Payment currency" className={selectClass} value={paymentCurrency} onChange={e => setPaymentCurrency(e.target.value)}>{Object.keys(CURRENCY_DIGITS).map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="block text-sm">Date<Input aria-label="Payment date" required type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label>
        <label className="block text-sm">Note<Input aria-label="Payment note" maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></label><Button disabled={pending || !data.people.length}><Check /> Record payment</Button>
      </form>
    </div>}
  </main>;
}