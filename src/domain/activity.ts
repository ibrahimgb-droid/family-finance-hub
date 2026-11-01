export function receiptActivity(dates: string[], today: string) {
  const days = new Set(dates);
  const current = new Date(`${today}T12:00:00Z`);
  const dateAt = (offset: number) => {
    const date = new Date(current);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  let streak = 0;
  let offset = days.has(today) ? 0 : -1;
  while (days.has(dateAt(offset))) { streak++; offset--; }
  const week = Array.from({ length: 7 }, (_, i) => ({ date: dateAt(i - 6), active: days.has(dateAt(i - 6)) }));
  return { streak, week, activeDays: week.filter((day) => day.active).length };
}