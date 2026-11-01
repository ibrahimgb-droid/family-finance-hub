import { expect, it } from "vitest";
import { receiptActivity } from "./activity";
it("counts consecutive receipt days once and keeps yesterday's streak active", () => {
  expect(receiptActivity(["2026-10-30", "2026-10-31", "2026-10-31"], "2026-11-01").streak).toBe(2);
});
it("counts seven-day activity without future days", () => {
  const result = receiptActivity(["2026-10-26", "2026-11-01", "2026-11-02"], "2026-11-01");
  expect(result.activeDays).toBe(2);
  expect(result.week).toHaveLength(7);
});