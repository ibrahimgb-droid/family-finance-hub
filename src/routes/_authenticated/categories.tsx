import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQueryKey, fetchCategories, type Category } from "@/lib/category-queries";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { isCustomCategory } from "@/domain/categories";
import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Check, X, Trash2 } from "lucide-react";

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
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

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
  const remove = useMutation({
    mutationFn: async (category: Category) => {
      if (!isCustomCategory(category.name)) throw new Error("Default categories can be hidden instead.");
      const { data, error } = await supabase.from("categories").delete().eq("id", category.id).eq("user_id", user.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("This category is no longer available.");
    },
    onSuccess: () => {
      setDeleteTarget(null); setErr(null); refresh();
      for (const queryKey of [["transactions"], ["tx"], ["category-breakdown"]]) qc.invalidateQueries({ queryKey });
    },
    onError: fail,
  });

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
          {visible.map((c) => <CategoryRow key={c.id} category={c} busy={update.isPending || remove.isPending} onDelete={() => { setErr(null); setDeleteTarget(c); }} onRename={(name) => update.mutate({ id: c.id, name })} onToggle={() => update.mutate({ id: c.id, is_hidden: true })} />)}
          {!categories.isLoading && visible.length === 0 && <li className="p-4 text-sm text-muted-foreground">No visible categories.</li>}
        </ul>
      </section>

      {hidden.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground">HIDDEN</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {hidden.map((c) => <CategoryRow key={c.id} category={c} busy={update.isPending || remove.isPending} onDelete={() => { setErr(null); setDeleteTarget(c); }} onRename={(name) => update.mutate({ id: c.id, name })} onToggle={() => update.mutate({ id: c.id, is_hidden: false })} />)}
          </ul>
        </section>
      )}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !remove.isPending) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Existing expenses will remain, but their category will become Uncategorized. Hide this category instead to keep it on past expenses.</AlertDialogDescription>
          </AlertDialogHeader>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => { if (deleteTarget) remove.mutate(deleteTarget); }}><Trash2 />{remove.isPending ? "Deleting…" : "Delete category"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function CategoryRow({ category, busy, onRename, onToggle, onDelete }: { category: Category; busy: boolean; onRename: (name: string) => void; onToggle: () => void; onDelete: () => void }) {
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
      {isCustomCategory(category.name) && <Button size="icon" variant="ghost" aria-label={`Delete ${category.name}`} title="Delete category" disabled={busy} onClick={onDelete}><Trash2 className="text-destructive" /></Button>}
    </li>
  );
}

function messageFor(e: unknown): string {
  const code = (e as { code?: string }).code;
  if (code === "23505") return "You already have a category with that name.";
  if (code === "23514") return "Category names must be 1 to 40 characters.";
  return "Something went wrong. Please try again.";
}
