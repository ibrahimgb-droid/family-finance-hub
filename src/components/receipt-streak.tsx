import { useState } from "react";
import { Flame, Check, ArrowUpRight } from "lucide-react";
import { receiptActivity } from "@/domain/activity";
import { Button } from "@/components/ui/button";

export function ReceiptStreak({ dates, today }: { dates: string[]; today: string }) {
  const [open, setOpen] = useState(false);
  const activity = receiptActivity(dates, today);
  return <article className="bento-tile flex flex-col bg-secondary/10 p-5">
    <div className="flex items-center justify-between"><span className="utility-label text-secondary"><Flame className="mr-2 inline size-4" /> Your streak</span><Button variant="ghost" size="icon" aria-label="Show streak details" title="Streak details" aria-expanded={open} onClick={() => setOpen(!open)}><ArrowUpRight /></Button></div>
    <p className="mt-4 font-display text-4xl font-bold">{activity.streak}<span className="ml-2 text-base font-medium text-muted-foreground">day{activity.streak === 1 ? "" : "s"}</span></p>
    <p className="mt-2 text-sm text-muted-foreground">{activity.streak ? "Look at you, staying on top of it." : "Your next receipt starts it."}</p>
    <div className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Receipt activity over the last seven days">{activity.week.map((day) => <div key={day.date} className="text-center"><span className={`flex aspect-square items-center justify-center rounded-full border text-xs ${day.active ? "border-secondary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground"}`} title={day.date}>{day.active ? <Check className="size-3.5" /> : new Date(`${day.date}T12:00:00Z`).getUTCDate()}</span><span className="mt-1 block text-[9px] text-muted-foreground">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en", { weekday: "narrow", timeZone: "UTC" })}</span></div>)}</div>
    {open && <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{activity.activeDays} of 7 days with confirmed receipts · {activity.streak} consecutive days</p>}
  </article>;
}