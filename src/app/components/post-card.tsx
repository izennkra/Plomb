import type { FeedItem } from "@/modules/depeches/list-feed";
import { formatFeedDate, isDayOnly } from "@/modules/depeches/format-date";
import { Carousel } from "./carousel";

const TYPE_LABELS: Record<FeedItem["source"]["type"], string> = {
  web: "Site web",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
};

/** One publication of the Salle de Dépêches. "En savoir plus" goes straight to the source. */
export function PostCard({ item, now }: { item: FeedItem; now: Date }) {
  const date = formatFeedDate(item.date, now, { dayOnly: item.dateIsPublication && isDayOnly(item.date) });
  return (
    <article className="card">
      <Carousel images={item.images} title={item.title} />
      <div className="card__body">
        <p className="card__meta">
          <span title={TYPE_LABELS[item.source.type]}>{item.source.displayName}</span>
          <span aria-hidden="true"> · </span>
          <time dateTime={item.date.toISOString()} title={item.dateIsPublication ? "Date de publication" : "Découvert par Plomb"}>
            {date}
          </time>
        </p>
        <h2 className="card__title">{item.title}</h2>
        {item.excerpt && <p className="card__excerpt">{item.excerpt}</p>}
        <a className="card__more" href={item.url} target="_blank" rel="noreferrer noopener">
          En savoir plus <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
