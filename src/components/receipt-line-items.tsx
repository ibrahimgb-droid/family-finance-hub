import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RECEIPT_CATEGORIES, receiptItemSum, signedAmountToMinor, type ReceiptItem } from "@/domain/receipt-items";
import { formatMinor } from "@/domain/money";

export type EditableReceiptItem = ReceiptItem & { unitPrice: string; amount: string };
export function ReceiptLineItems({ items, currency, total, disabled, onChange }: {
  items: EditableReceiptItem[]; currency: string; total: string; disabled: boolean;
  onChange: (items: EditableReceiptItem[]) => void;
}) {
  const field = "min-w-0 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
  const update = (index: number, patch: Partial<EditableReceiptItem>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const sum = receiptItemSum(items.map((item) => ({ ...item, total_minor: signedAmountToMinor(item.amount, currency) })));
  const receiptTotal = signedAmountToMinor(total, currency);
  const difference = sum !== null && receiptTotal !== null ? BigInt(receiptTotal) - sum : null;
  return <section className="mt-6 border-t border-border pt-5" aria-label="Receipt line items">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Line items <span className="text-sm text-muted-foreground">({items.length})</span></h2>
      {!disabled && <Button type="button" variant="outline" size="icon" aria-label="Add line item" title="Add line item" onClick={() => onChange([...items, { description: "", quantity: null, unit_price_minor: null, total_minor: null, category: "Other", unitPrice: "", amount: "" }])}><Plus /></Button>}
    </div>
    {items.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No line items were read.</p>}
    <ol className="mt-3 divide-y divide-border">
      {items.map((item, index) => <li key={index} className="space-y-3 py-4">
        <div className="flex gap-2">
          <input aria-label={`Item ${index + 1} description`} placeholder="Item description" maxLength={200} className={field} value={item.description} disabled={disabled} onChange={(e) => update(index, { description: e.target.value })} />
          {!disabled && <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} title="Remove item" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 className="text-muted-foreground" /></Button>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-muted-foreground">Quantity<input aria-label={`Item ${index + 1} quantity`} className={field} inputMode="decimal" placeholder="—" value={item.quantity ?? ""} disabled={disabled} onChange={(e) => update(index, { quantity: e.target.value || null })} /></label>
          <label className="text-xs text-muted-foreground">Unit price<input aria-label={`Item ${index + 1} unit price`} className={field} inputMode="decimal" placeholder="—" value={item.unitPrice} disabled={disabled} onChange={(e) => update(index, { unitPrice: e.target.value })} /></label>
          <label className="text-xs text-muted-foreground">Amount<input aria-label={`Item ${index + 1} amount`} className={field} inputMode="decimal" placeholder="—" value={item.amount} disabled={disabled} onChange={(e) => update(index, { amount: e.target.value })} /></label>
        </div>
        <select aria-label={`Item ${index + 1} category`} className={field} value={item.category} disabled={disabled} onChange={(e) => update(index, { category: e.target.value })}>
          {RECEIPT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
      </li>)}
    </ol>
    {items.length > 0 && <div className="border-t border-border py-3 text-sm">
      <div className="flex justify-between gap-2"><span className="text-muted-foreground">Items total</span><span className="font-semibold">{sum === null ? "Incomplete" : formatMinor(sum, currency)}</span></div>
      {difference !== null && difference !== 0n && <p className="mt-2 text-muted-foreground">Difference from receipt total: {formatMinor(difference, currency)} (tax, discounts or unread items).</p>}
    </div>}
  </section>;
}