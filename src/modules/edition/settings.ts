import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { toSchedule, type Schedule } from "./schedule";

export async function getSchedule(db: Db, userId: string): Promise<Schedule> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return toSchedule(user?.editionFrequency, user?.editionWeekdays);
}

export async function saveSchedule(db: Db, userId: string, schedule: Schedule): Promise<Schedule> {
  const clean = toSchedule(schedule.frequency, schedule.weekdays);
  await db
    .update(users)
    .set({ editionFrequency: clean.frequency, editionWeekdays: clean.weekdays })
    .where(eq(users.id, userId));
  return clean;
}
