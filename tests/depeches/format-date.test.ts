import { describe, expect, it } from "vitest";
import { formatFeedDate } from "@/modules/depeches/format-date";

const now = new Date("2026-10-20T14:00:00+02:00"); // Tuesday, Paris time

describe("formatFeedDate", () => {
  it.each([
    ["2026-10-20T13:59:30+02:00", "à l'instant"],
    ["2026-10-20T13:35:00+02:00", "il y a 25 min"],
    ["2026-10-20T09:00:00+02:00", "il y a 5 h"],
    ["2026-10-19T22:00:00+02:00", "hier"],
    ["2026-10-17T10:00:00+02:00", "samedi 17 octobre"],
  ])("%s → %s", (date, expected) => {
    expect(formatFeedDate(new Date(date), now)).toBe(expected);
  });

  it("uses Paris time for « hier »: just after midnight is today", () => {
    expect(formatFeedDate(new Date("2026-10-20T00:30:00+02:00"), now)).toBe("il y a 13 h");
  });

  it("a date given without time (published « on the 19th ») reads as a day", () => {
    expect(formatFeedDate(new Date("2026-10-19"), now, { dayOnly: true })).toBe("hier");
    expect(formatFeedDate(new Date("2026-10-20"), now, { dayOnly: true })).toBe("aujourd'hui");
  });
});
