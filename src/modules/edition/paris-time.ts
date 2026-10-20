const TIME_ZONE = "Europe/Paris";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function wallClock(date: Date): { day: string; time: number } {
  const p = Object.fromEntries(parts.formatToParts(date).map((part) => [part.type, part.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) };
}

/** Day in Paris, e.g. "2026-10-21". */
export function parisDay(date: Date): string {
  return wallClock(date).day;
}

/** The moment it is `hour`:00 in Paris on `day` (handles summer / winter time). */
export function parisTime(day: string, hour: number): Date {
  const [year, month, date] = day.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour);
  const offset = wallClock(new Date(guess)).time - guess;
  return new Date(guess - offset);
}
