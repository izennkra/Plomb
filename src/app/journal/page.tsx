import Link from "next/link";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { getEditionItems, isBuilding, listEditions } from "@/modules/edition/list";
import { parisDay, parisTime } from "@/modules/edition/paris-time";
import { addDays, nextEditionDay } from "@/modules/edition/schedule";
import { getSchedule } from "@/modules/edition/settings";
import { isPreparingEdition, prepareEditionAction } from "../actions";
import { AutoRefresh } from "../auto-refresh";
import { EditionArticle } from "../components/edition-article";
import { ScheduleForm } from "../components/schedule-form";

export const dynamic = "force-dynamic";

const longDay = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${day}T12:00:00Z`),
  );

type SearchParams = Promise<{ edition?: string }>;

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  const { edition: editionParam } = await searchParams;
  const db = await getDb();
  const editions = await listEditions(db, DEFAULT_USER_ID);
  const preparing = (await isPreparingEdition()) || editions.some((edition) => isBuilding(edition));
  const edition = editions.find((e) => String(e.id) === editionParam) ?? editions.find((e) => e.status === "ready");
  const items = edition ? await getEditionItems(db, edition.id) : [];
  const une = items.filter((item) => item.placement === "une");
  const secondary = items.filter((item) => item.placement === "secondaire");
  const rest = items.filter((item) => item.placement === "suite");

  // Next publication: today if it is before 9:00 and not out yet, otherwise from tomorrow.
  const schedule = await getSchedule(db, DEFAULT_USER_ID);
  const now = new Date();
  const today = parisDay(now);
  const lastReady = editions.find((e) => e.status === "ready")?.day;
  const fromDay = now < parisTime(today, 9) && lastReady !== today ? today : addDays(today, 1);
  const nextDay = nextEditionDay(schedule, fromDay, lastReady);

  return (
    <main>
      <AutoRefresh active={preparing} intervalMs={5000} />
      <div className="journal-header">
        <div>
          <h1 className="page-title">{edition ? `Journal du ${longDay(edition.day)}` : "Journal"}</h1>
          {edition && <p className="card__meta">{edition.message} · rédigé par {edition.model}</p>}
        </div>
        <form action={prepareEditionAction}>
          <button type="submit" disabled={preparing}>
            {preparing ? "Édition en préparation… (quelques minutes)" : "Préparer l'édition"}
          </button>
        </form>
      </div>

      <ScheduleForm schedule={schedule} next={nextDay ? longDay(nextDay) : null} />

      {!edition ? (
        <p>Pas encore d&apos;édition. Cliquez sur « Préparer l&apos;édition » : l&apos;IA rédige le journal à partir des nouveaux articles de vos sources.</p>
      ) : items.length === 0 ? (
        <p>{edition.message}</p>
      ) : (
        <>
          <section aria-label="À la Une" className="journal-une">
            {une.map((item) => (
              <EditionArticle key={item.id} item={item} />
            ))}
            <div className="journal-secondary">
              {secondary.map((item) => (
                <EditionArticle key={item.id} item={item} />
              ))}
            </div>
          </section>
          {rest.length > 0 && (
            <section aria-label="La suite de l'actualité">
              <h2 className="journal-section-title">La suite de l&apos;actualité</h2>
              <div className="journal-rest">
                {rest.map((item) => (
                  <EditionArticle key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {editions.length > 0 && (
        <nav className="journal-archive" aria-label="Éditions précédentes">
          <h2 className="journal-section-title">Éditions de la semaine</h2>
          <ul>
            {editions.map((e) => (
              <li key={e.id}>
                {e.id === edition?.id ? (
                  <strong>{longDay(e.day)}</strong>
                ) : e.status === "ready" ? (
                  <Link href={`/journal?edition=${e.id}`}>{longDay(e.day)}</Link>
                ) : (
                  <span>{longDay(e.day)} ({isBuilding(e) ? "en préparation" : "interrompue"})</span>
                )}
                {e.status === "ready" && (
                  <>
                    {" "}
                    · <a href={`/journal/${e.id}/email`} target="_blank" rel="noreferrer">aperçu de l&apos;e-mail</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}
