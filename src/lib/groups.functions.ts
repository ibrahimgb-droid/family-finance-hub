import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { groupSplit } from "@/domain/group-split";
import { parseToMinor } from "@/domain/money";

const expenseInput = z.object({
  groupId: z.string().uuid(), payerId: z.string().uuid(), description: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), currency: z.string().length(3), amount: z.string(),
  method: z.enum(["equal", "fixed", "percentage", "shares", "member_count", "weighted_family", "consumption_units"]),
  includedIds: z.array(z.string().uuid()).min(1), inputs: z.record(z.string()),
});

export const saveGroupExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => expenseInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: people, error } = await context.supabase.from("family_members").select("*").eq("group_id", data.groupId).order("created_at").order("id");
    if (error) throw error;
    if (!people?.length || !people.some(p => p.id === data.payerId)) throw new Error("Choose a payer in this group");
    if (new Set(data.includedIds).size !== data.includedIds.length || data.includedIds.some(id => !people.some(p => p.id === id))) throw new Error("Invalid participants");
    const total = parseToMinor(data.amount, data.currency);
    const allocations = groupSplit(total, data.currency, data.method, people.map(p => ({ id: p.id, familyId: p.family_unit_id, included: data.includedIds.includes(p.id), weightMilli: p.weight_milli })), data.inputs);
    if (allocations.reduce((sum, a) => sum + a.amountMinor, 0n) !== total) throw new Error("Invalid split total");
    // Fail closed until the atomic expense RPC and reference guards can be applied.
    // Lovable Cloud was unavailable during module H implementation.
    throw new Error("Shared expense saving is awaiting completion of the Cloud setup.");
  });

export const createGroupInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ groupId: z.string().uuid(), memberId: z.string().uuid(), email: z.union([z.string().email(), z.literal("")]) }).parse(data))
  .handler(async ({ data, context }) => {
    const token = crypto.randomUUID() + crypto.randomUUID();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
    const { error } = await context.supabase.from("invitations").insert({ group_id: data.groupId, invited_by: context.userId, family_member_id: data.memberId, email: data.email.trim() || null, token_hash: hash });
    if (error) throw new Error("The invitation could not be created.");
    return { token };
  });