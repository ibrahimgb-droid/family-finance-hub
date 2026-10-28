import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({ receiptId: z.string().uuid() });

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { EXTRACTION_SCHEMA_VERSION, scrubPan, amountToMinor } = await import("@/domain/receipt");
    const { CURRENCY_DIGITS } = await import("@/domain/money");

    const { data: rec, error } = await supabase.from("receipts").select("*").eq("id", data.receiptId).single();
    if (error || !rec) return { ok: false as const, error: "Receipt not found" };

    const file = await supabase.storage.from("receipts").download(rec.storage_path);
    if (file.error) return { ok: false as const, error: "Could not read the receipt file" };
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const b64 = btoa(bin);

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "AI is not configured" };
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const schema = z.object({
      merchant: z.string().nullable(),
      date: z.string().nullable().describe("YYYY-MM-DD"),
      currency: z.string().nullable().describe("ISO 4217 code"),
      total: z.string().nullable().describe("decimal string, e.g. 12.350"),
      tax: z.string().nullable(),
      document_ref: z.string().nullable().describe("invoice/receipt number"),
      raw_text: z.string().describe("all visible text, as read"),
    });

    const isPdf = rec.mime_type === "application/pdf";
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: "You read GCC shop receipts in Arabic or English. Return only what is printed; use null when unsure. Never output full card numbers.",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Extract the receipt fields." },
            isPdf
              ? { type: "file", data: b64, mediaType: "application/pdf", filename: "receipt.pdf" }
              : { type: "image", image: b64, mediaType: rec.mime_type },
          ],
        }],
        output: Output.object({ schema }),
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;

      const currency = out.currency && CURRENCY_DIGITS[out.currency.toUpperCase()] !== undefined ? out.currency.toUpperCase() : "KWD";
      const digits = CURRENCY_DIGITS[currency]!;
      const total = amountToMinor(out.total, digits) ?? 0n;
      let tax = amountToMinor(out.tax, digits) ?? 0n;
      if (tax > total) tax = 0n;
      const date = out.date && /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : new Date().toISOString().slice(0, 10);
      const clean = { ...out, raw_text: scrubPan(out.raw_text) };

      await supabase.from("receipts").update({
        ocr_text: clean.raw_text.slice(0, 20000), extraction: clean, extraction_schema_version: EXTRACTION_SCHEMA_VERSION,
      }).eq("id", rec.id);

      const { data: tx, error: txErr } = await supabase.from("transactions").insert({
        user_id: userId, status: "draft", source: "receipt", receipt_id: rec.id,
        merchant: out.merchant?.slice(0, 120) ?? null, occurred_on: date, currency,
        total_minor: total.toString() as unknown as number, tax_minor: tax.toString() as unknown as number,
        document_ref: out.document_ref?.slice(0, 64) ?? null,
      }).select("id").single();
      if (txErr) return { ok: false as const, error: txErr.message };
      return { ok: true as const, transactionId: tx.id };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) return { ok: false as const, error: "Couldn't read this receipt. You can enter it by hand." };
      const status = (e as { statusCode?: number }).statusCode;
      console.error("extractReceipt", status, e);
      if (status === 402) return { ok: false as const, error: "AI credits have run out." };
      if (status === 429) return { ok: false as const, error: "Too many requests — try again in a minute." };
      return { ok: false as const, error: "The receipt reader is unavailable right now." };
    }
  });
