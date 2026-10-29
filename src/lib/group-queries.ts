import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const groupsQuery = queryOptions({ queryKey: ["groups"], queryFn: async () => {
  const { data, error } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
} });

export const groupQuery = (id: string) => queryOptions({ queryKey: ["group", id], queryFn: async () => {
  const [group, units, people, expenses, allocations, settlements, membership, invites] = await Promise.all([
    supabase.from("groups").select("*").eq("id", id).single(),
    supabase.from("family_units").select("*").eq("group_id", id).order("created_at").order("id"),
    supabase.from("family_members").select("*").eq("group_id", id).order("created_at").order("id"),
    supabase.from("group_expenses").select("*").eq("group_id", id).eq("status", "confirmed").order("occurred_on", { ascending: false }),
    supabase.from("expense_allocations").select("*").eq("group_id", id),
    supabase.from("settlements").select("*").eq("group_id", id).order("created_at", { ascending: false }),
    supabase.from("group_members").select("*").eq("group_id", id),
    supabase.from("invitations").select("id,email,status,expires_at,family_member_id").eq("group_id", id).order("created_at", { ascending: false }),
  ]);
  for (const result of [group, units, people, expenses, allocations, settlements, membership, invites]) if (result.error) throw result.error;
  return { group: group.data, units: units.data ?? [], people: people.data ?? [], expenses: expenses.data ?? [], allocations: allocations.data ?? [], settlements: settlements.data ?? [], membership: membership.data ?? [], invites: invites.data ?? [] };
} });