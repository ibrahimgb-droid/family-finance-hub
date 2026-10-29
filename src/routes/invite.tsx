import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/invite")({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search["token"] === "string" ? search["token"] : "" }),
  head: () => ({ meta: [{ title: "Group invitation — Personal Finance App" }, { name: "description", content: "Accept a private invitation to share family expenses." }, { property: "og:title", content: "Group invitation — Personal Finance App" }, { property: "og:description", content: "Join your family's private spending group." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Invitation,
});
function Invitation() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { setSignedIn(!!data.user); setReady(true); }); }, []);
  return <main className="mx-auto min-h-screen max-w-md px-5 py-12"><Users className="size-8 text-primary" /><h1 className="mt-5 text-3xl">Group invitation</h1>
    {!token ? <p className="mt-4 text-destructive">This invitation is missing its code.</p> : !ready ? <p className="mt-4 text-muted-foreground">Loading…</p> : signedIn ? <Button className="mt-6" disabled={pending} onClick={async () => { setPending(true); setError(""); try { const { data, error } = await supabase.rpc("accept_invitation", { _token: token }); if (error) throw error; navigate({ to: "/groups/$groupId", params: { groupId: data } }); } catch (e) { setError(e instanceof Error ? e.message : "Invitation unavailable"); } finally { setPending(false); } }}>Accept invitation</Button> : <><p className="mt-4 text-muted-foreground">Sign in to accept your invitation.</p><Button asChild className="mt-6"><Link to="/auth" onClick={() => sessionStorage.setItem("pending-group-invitation", token)}>Sign in</Link></Button></>}
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
  </main>;
}