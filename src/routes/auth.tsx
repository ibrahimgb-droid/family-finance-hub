import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Personal Finance App" },
      { name: "description", content: "Sign in to track your spending and share costs with your family." },
      { property: "og:title", content: "Sign in — Personal Finance App" },
      { property: "og:description", content: "Sign in to your Personal Finance App account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/ledger", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/ledger", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/ledger" } });
      setMsg(error ? error.message : data.session ? null : "Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r && "error" in r && r.error) setMsg(String((r.error as Error).message ?? r.error));
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Personal Finance App</p>
      <h1 className="mt-2 text-3xl">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
      <button onClick={google} className="mt-8 w-full rounded-xl border border-input bg-card py-3 font-semibold">
        Continue with Google
      </button>
      <p className="my-5 text-center text-xs text-muted-foreground">or with email</p>
      <form onSubmit={submit} className="space-y-3">
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3" />
        <input type="password" required minLength={8} placeholder="Password (8+ characters)" value={password}
          onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3" />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
          {mode === "in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}
      <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-6 text-sm text-primary underline">
        {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
