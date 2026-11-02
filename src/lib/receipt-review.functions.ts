import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { RECEIPT_CATEGORIES } from "@/domain/receipt-items";

const reviewSchema = z.object({
  id: z.string().uuid(), status: z.enum(["confirmed", "void"]),
  merchant: z.string().max(120), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), currency: z.string(),
  total: z.string(), tax: z.string(), categoryId: z.string().uuid().nullable(),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(200),
    quantity: z.string().regex(/^\d+(?:\.\d+)?$/).nullable(),
    unit_price_minor: z.string().regex(/^-?\d+$/).nullable(),
    total_minor: z.string().regex(/^-?\d+$/).nullable(),
    category: z.enum(RECEIPT_CATEGORIES),
  })),
});

export const saveReceiptReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { parseToMinor } = await import("@/domain/money");
    const { scrubPan } = await import("@/domain/receipt");
    const total = parseToMinor(data.total, data.currency);
    const tax = parseToMinor(data.tax || "0", data.currency);
    if (tax > total) throw new Error("Tax cannot exceed the receipt total.");
    const patch = data.status === "void" ? { status: data.status, confirmed_at: null } : {
      status: data.status, confirmed_at: new Date().toISOString(), merchant: scrubPan(data.merchant.trim()) || null,
      occurred_on: data.date, currency: data.currency, total_minor: total.toString() as unknown as number, category_id: data.categoryId,
      tax_minor: tax.toString() as unknown as number,
      line_items: data.items.map((item) => ({ ...item, description: scrubPan(item.description) })),
    };
    const { data: tx, error } = await context.supabase.from("transactions").update(patch)
      .eq("id", data.id).eq("user_id", context.userId).eq("status", "draft").select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("This receipt is no longer a draft or is unavailable.");
    return { ok: true };
  });