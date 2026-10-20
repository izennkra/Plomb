const TIME_ZONE = "Europe/Paris";

const dayKey = new Intl.DateTimeFormat("fr-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const longDay = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

/** Days between two dates, counted on the Paris calendar (yesterday 23:00 → today 01:00 = 1 day). */
function calendarDays(date: Date, now: Date): number {
  const toDay = (value: Date) => Date.parse(`${dayKey.format(value)}T00:00:00Z`);
  return Math.round((toDay(now) - toDay(date)) / 86_400_000);
}

/**
 * Date shown on a card: "à l'instant", "il y a 25 min", "il y a 5 h", "hier", "samedi 17 octobre".
 * `dayOnly`: the site only gave a day (no time), so hours would be made up.
 */
export function formatFeedDate(date: Date, now = new Date(), { dayOnly = false } = {}): string {
  const days = calendarDays(date, now);
  if (dayOnly) {
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "hier";
    return longDay.format(date);
  }

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (days === 0) return `il y a ${Math.floor(minutes / 60)} h`;
  if (days === 1) return "hier";
  return longDay.format(date);
}

/** A date at exactly midnight UTC usually means the site only gave a day (2026-10-19). */
export function isDayOnly(date: Date): boolean {
  return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
}
