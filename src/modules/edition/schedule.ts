/** How often the journal comes out. It is always published at 9:00. */
export type Frequency = "daily" | "every3days" | "weekdays";

/** Weekdays from 1 (Monday) to 7 (Sunday). */
export type Schedule = { frequency: Frequency; weekdays: number[] };

export const DEFAULT_SCHEDULE: Schedule = { frequency: "daily", weekdays: [1, 2, 3, 4, 5] };
const DAY_MS = 24 * 60 * 60 * 1000;

const toTime = (day: string) => Date.parse(`${day}T12:00:00Z`);
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);
export const addDays = (day: string, days: number) => toDay(toTime(day) + days * DAY_MS);
const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY_MS);

/** 1 (Monday) … 7 (Sunday). */
export function weekdayOf(day: string): number {
  return new Date(toTime(day)).getUTCDay() || 7;
}

/** Does the journal come out on this day? */
export function isEditionDay(schedule: Schedule, day: string, lastEditionDay?: string): boolean {
  switch (schedule.frequency) {
    case "daily":
      return true;
    case "every3days":
      return !lastEditionDay || daysBetween(lastEditionDay, day) >= 3;
    case "weekdays":
      return schedule.weekdays.includes(weekdayOf(day));
  }
}

/** Days covered by an edition when there is no previous one: 1, 3, or since the previous chosen weekday. */
export function coverageDays(schedule: Schedule, day: string): number {
  if (schedule.frequency === "daily") return 1;
  if (schedule.frequency === "every3days") return 3;
  for (let back = 1; back <= 7; back++) {
    if (schedule.weekdays.includes(weekdayOf(addDays(day, -back)))) return back;
  }
  return 7;
}

/** Next day the journal comes out, from `fromDay` included. Null when no day is chosen. */
export function nextEditionDay(schedule: Schedule, fromDay: string, lastEditionDay?: string): string | null {
  for (let ahead = 0; ahead < 14; ahead++) {
    const day = addDays(fromDay, ahead);
    if (isEditionDay(schedule, day, lastEditionDay)) return day;
  }
  return null;
}

/** Reads a stored schedule, falling back to every day. */
export function toSchedule(frequency: string | null | undefined, weekdays: unknown): Schedule {
  const days = Array.isArray(weekdays) ? weekdays.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7) : [];
  if (frequency === "every3days") return { frequency, weekdays: days };
  if (frequency === "weekdays" && days.length > 0) return { frequency, weekdays: [...new Set(days)].sort() };
  return { ...DEFAULT_SCHEDULE, weekdays: days.length ? days : DEFAULT_SCHEDULE.weekdays };
}
