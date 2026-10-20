import { describe, expect, it } from "vitest";
import { coverageDays, isEditionDay, nextEditionDay, toSchedule, weekdayOf } from "@/modules/edition/schedule";

const daily = toSchedule("daily", []);
const every3 = toSchedule("every3days", []);
const monWedFri = toSchedule("weekdays", [5, 1, 3]);

describe("journal schedule", () => {
  it("knows the weekday (2026-10-20 is a Tuesday)", () => {
    expect(weekdayOf("2026-10-20")).toBe(2);
    expect(weekdayOf("2026-10-25")).toBe(7);
  });

  it("daily: every day, covering 24 hours", () => {
    expect(isEditionDay(daily, "2026-10-25")).toBe(true);
    expect(coverageDays(daily, "2026-10-21")).toBe(1);
  });

  it("every 3 days: 3 days after the last edition, covering 3 days", () => {
    expect(isEditionDay(every3, "2026-10-21", "2026-10-20")).toBe(false);
    expect(isEditionDay(every3, "2026-10-23", "2026-10-20")).toBe(true);
    expect(isEditionDay(every3, "2026-10-21")).toBe(true); // first edition
    expect(coverageDays(every3, "2026-10-23")).toBe(3);
    expect(nextEditionDay(every3, "2026-10-21", "2026-10-20")).toBe("2026-10-23");
  });

  it("chosen days: only those, covering since the previous chosen day", () => {
    expect(monWedFri.weekdays).toEqual([1, 3, 5]);
    expect(isEditionDay(monWedFri, "2026-10-21")).toBe(true); // Wednesday
    expect(isEditionDay(monWedFri, "2026-10-22")).toBe(false); // Thursday
    expect(coverageDays(monWedFri, "2026-10-26")).toBe(3); // Monday ← Friday
    expect(coverageDays(monWedFri, "2026-10-21")).toBe(2); // Wednesday ← Monday
    expect(nextEditionDay(monWedFri, "2026-10-22")).toBe("2026-10-23");
  });

  it("falls back to every day when nothing valid is stored", () => {
    expect(toSchedule(null, null).frequency).toBe("daily");
    expect(toSchedule("weekdays", []).frequency).toBe("daily");
    expect(toSchedule("weekdays", [9, 2]).weekdays).toEqual([2]);
  });
});

describe("schedule settings", () => {
  it("are stored per user, every day by default, and cleaned", async () => {
    const { createTestDb } = await import("../helpers/test-db");
    const { DEFAULT_USER_ID } = await import("@/db/client");
    const { getSchedule, saveSchedule } = await import("@/modules/edition/settings");
    const db = await createTestDb();

    expect((await getSchedule(db, DEFAULT_USER_ID)).frequency).toBe("daily");
    await saveSchedule(db, DEFAULT_USER_ID, { frequency: "weekdays", weekdays: [5, 1, 1, 9] });
    expect(await getSchedule(db, DEFAULT_USER_ID)).toEqual({ frequency: "weekdays", weekdays: [1, 5] });
  });
});
