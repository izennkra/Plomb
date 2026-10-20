import type { FeedItem } from "@/modules/depeches/list-feed";
import { formatFeedDate, isDayOnly } from "@/modules/depeches/format-date";
import { Carousel } from "./carousel";

/** One publication of the Salle de Dépêches. "En savoir plus" goes straight to the source. */
export function PostCard({ item, now }: { item: FeedItem; now: Date }) {
  // Social posts: the title is the start of the text; the text is shown only when it says more.
  const excerpt = item.excerpt && !item.excerpt.startsWith(item.title.replace(/…$/, "")) ? item.excerpt : null;
  const date = formatFeedDate(item.date, now, { dayOnly: item.dateIsPublication && isDayOnly(item.date) });
  return (
    <article className="card">
      <header className="card__head">
        <h2 className="card__title">{item.title}</h2>
        <p className="card__meta">
          {item.source.displayName}
          <span aria-hidden="true"> · </span>
          <time dateTime={item.date.toISOString()} title={item.dateIsPublication ? "Date de publication" : "Découvert par Plomb"}>
            {date}
          </time>
        </p>
      </header>
      <Carousel images={item.images} title={item.title} />
      {excerpt && <p className="card__excerpt">{excerpt}</p>}
      <a className="card__more" href={item.url} target="_blank" rel="noreferrer noopener">
        En savoir plus
      </a>
    </article>
  );
}
