import Link from "next/link";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { windowSlots } from "@/modules/edition/layout";
import { getEditionItems, isBuilding, listEditions } from "@/modules/edition/list";
import { parisDay, parisTime } from "@/modules/edition/paris-time";
import { addDays, nextEditionDay } from "@/modules/edition/schedule";
import { getSchedule } from "@/modules/edition/settings";
import { isPreparingEdition, prepareEditionAction } from "../actions";
import { AutoRefresh } from "../auto-refresh";
import { EditionWindow, UneDetails } from "../components/edition-article";
import { ScheduleForm } from "../components/schedule-form";
import { EditionKeys } from "./edition-keys";
import { JournalGrid } from "./journal-grid";
import { Une } from "./une";

export const dynamic = "force-dynamic";

const longDay = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${day}T12:00:00Z`),
  );
const shortDay = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "");
/** "21 OCT 2026", as on the edition tag. */
const badgeDay = (day: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${day}T12:00:00Z`))
    .toUpperCase();

type SearchParams = Promise<{ edition?: string }>;

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  const { edition: editionParam } = await searchParams;
  const db = await getDb();
  const editions = await listEditions(db, DEFAULT_USER_ID);
  const preparing = (await isPreparingEdition()) || editions.some((edition) => isBuilding(edition));
  const ready = editions.filter((e) => e.status === "ready");
  const edition = ready.find((e) => String(e.id) === editionParam) ?? ready[0];
  const items = edition ? await getEditionItems(db, edition.id) : [];
  const une = items.find((item) => item.placement === "une");
  const others = items.filter((item) => item.placement !== "une");
  const slots = windowSlots(others.length);

  // Editions of the week, from the newest: ← goes back in time, → comes forward.
  const index = edition ? ready.indexOf(edition) : -1;
  const older = ready[index + 1];
  const newer = index > 0 ? ready[index - 1] : undefined;
  const href = (e: { id: number }) => `/journal?edition=${e.id}`;

  // Next publication: today if it is before 9:00 and not out yet, otherwise from tomorrow.
  const schedule = await getSchedule(db, DEFAULT_USER_ID);
  const now = new Date();
  const today = parisDay(now);
  const fromDay = now < parisTime(today, 9) && ready[0]?.day !== today ? today : addDays(today, 1);
  const nextDay = nextEditionDay(schedule, fromDay, ready[0]?.day);
  const next = nextDay ? `${longDay(nextDay)} à 9h00` : null;

  const headline = !edition
    ? `Ton premier journal paraîtra ${next ?? "bientôt"}.`
    : (une?.title ?? edition.message ?? "Pas de nouvelles de tes sources depuis le dernier journal.");
  const badge = edition ? `Édition N°${edition.id}, ${badgeDay(edition.day)}` : "Plomb";

  return (
    <main className="journal">
      <AutoRefresh active={preparing} intervalMs={5000} />
      <EditionKeys older={older && href(older)} newer={newer && href(newer)} />
      <h1 className="visually-hidden">{edition ? `Journal du ${longDay(edition.day)}` : "Journal"}</h1>

      <nav className="journal-bar" aria-label="Éditions">
        {older ? (
          <Link className="chip" href={href(older)} aria-label={`Édition précédente : ${longDay(older.day)}`}>
            ← {shortDay(older.day)}
          </Link>
        ) : (
          <span />
        )}
        <span className="journal-bar__right">
          {preparing && <span className="chip chip--dark">Édition en préparation…</span>}
          {newer && (
            <Link className="chip" href={href(newer)} aria-label={`Édition suivante : ${longDay(newer.day)}`}>
              {shortDay(newer.day)} →
            </Link>
          )}
          <details className="settings">
            <summary className="chip">Réglages</summary>
            <div className="settings__panel">
              <ScheduleForm schedule={schedule} next={next} />
              <form action={prepareEditionAction}>
                <button type="submit" disabled={preparing}>
                  {preparing ? "Préparation en cours…" : "Préparer l'édition maintenant"}
                </button>
              </form>
              {edition && (
                <a href={`/journal/${edition.id}/email`} target="_blank" rel="noreferrer">
                  Aperçu de l&apos;e-mail
                </a>
              )}
            </div>
          </details>
        </span>
      </nav>

      <JournalGrid>
        <div className="journal-grid__cell journal-grid__cell--une">
          <Une title={headline} badge={badge} details={une ? <UneDetails item={une} /> : undefined} />
        </div>
        {others.map((item, position) => (
          <EditionWindow key={item.id} item={item} slot={slots[position]} />
        ))}
      </JournalGrid>
    </main>
  );
}
