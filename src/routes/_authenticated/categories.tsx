import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQueryKey, fetchCategories, type Category } from "@/lib/category-queries";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Personal Finance App" },
      { name: "description", content: "Add, rename and hide the categories you use for expenses." },
      { property: "og:title", content: "Categories — Personal Finance App" },
      { property: "og:description", content: "Organise your expenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Categories,
});

const inputClass = "w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm";

function Categories() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const categories = useQuery({ queryKey: categoriesQueryKey, queryFn: fetchCategories });

  const refresh = () => qc.invalidateQueries({ queryKey: categoriesQueryKey });
  const fail = (e: unknown) => setErr(messageFor(e));

  const add = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("categories").insert({ user_id: user.id, name });
      if (error) throw error;
    },
    onSuccess: () => { setNewName(""); setErr(null); refresh(); },
    onError: fail,
  });

  const update = useMutation({
    mutationFn: async (patch: { id: string; name?: string; is_hidden?: boolean }) => {
      const { id, ...values } = patch;
      const { error } = await supabase.from("categories").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setErr(null); refresh(); },
    onError: fail,
  });

  const visible = (categories.data ?? []).filter((c) => !c.is_hidden);
  const hidden = (categories.data ?? []).filter((c) => c.is_hidden);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 md:py-10">
      <Link to="/ledger" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to my spending</Link>
      <h1 className="mt-4 text-4xl leading-none">Categories</h1>
      <p className="mt-3 text-sm text-muted-foreground">Hidden categories stay on past expenses but are not offered for new ones.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); const name = newName.trim(); if (name) add.mutate(name); }}
        className="mt-6 flex gap-2"
      >
        <input aria-label="New category name" placeholder="New category" maxLength={40} value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
        <Button type="submit" disabled={add.isPending || !newName.trim()}><Plus />Add</Button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}

      {categories.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading categories…</p>}
      {categories.error && <p className="mt-8 text-sm text-destructive">Couldn't load your categories.</p>}

      <section className="mt-8">
        <h2 className="text-xs font-bold tracking-widest text-muted-foreground">SHOWN WHEN LOGGING</h2>
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {visible.map((c) => <CategoryRow key={c.id} category={c} busy={update.isPending} onRename={(name) => update.mutate({ id: c.id, name })} onToggle={() => update.mutate({ id: c.id, is_hidden: true })} />)}
          {!categories.isLoading && visible.length === 0 && <li className="p-4 text-sm text-muted-foreground">No visible categories.</li>}
        </ul>
      </section>

      {hidden.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground">HIDDEN</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {hidden.map((c) => <CategoryRow key={c.id} category={c} busy={update.isPending} onRename={(name) => update.mutate({ id: c.id, name })} onToggle={() => update.mutate({ id: c.id, is_hidden: false })} />)}
          </ul>
        </section>
      )}
    </main>
  );
}

function CategoryRow({ category, busy, onRename, onToggle }: { category: Category; busy: boolean; onRename: (name: string) => void; onToggle: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  if (editing) {
    return (
      <li className="flex items-center gap-2 p-3">
        <input aria-label={`Rename ${category.name}`} maxLength={40} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass} />
        <Button size="icon" variant="ghost" aria-label="Save name" disabled={busy || !draft.trim()} onClick={() => { onRename(draft.trim()); setEditing(false); }}><Check /></Button>
        <Button size="icon" variant="ghost" aria-label="Cancel rename" onClick={() => { setDraft(category.name); setEditing(false); }}><X /></Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-3">
      <span className={`flex-1 truncate text-sm ${category.is_hidden ? "text-muted-foreground" : "font-semibold"}`}>{category.name}</span>
      <Button size="icon" variant="ghost" aria-label={`Rename ${category.name}`} disabled={busy} onClick={() => { setDraft(category.name); setEditing(true); }}><Pencil /></Button>
      <Button size="icon" variant="ghost" aria-label={category.is_hidden ? `Show ${category.name}` : `Hide ${category.name}`} disabled={busy} onClick={onToggle}>{category.is_hidden ? <Eye /> : <EyeOff />}</Button>
    </li>
  );
}

function messageFor(e: unknown): string {
  const code = (e as { code?: string }).code;
  if (code === "23505") return "You already have a category with that name.";
  if (code === "23514") return "Category names must be 1 to 40 characters.";
  return "Something went wrong. Please try again.";
}
