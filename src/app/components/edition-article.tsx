import type { EditionItem } from "@/db/schema";
import { Carousel } from "./carousel";

/** An article of the journal. The Une is big, secondary ones medium, the rest compact. Favourites are highlighted. */
export function EditionArticle({ item }: { item: EditionItem }) {
  const text = item.placement === "suite" ? item.summary : (item.leadText ?? item.summary);
  return (
    <article className={`edition-article edition-article--${item.placement}${item.favorite ? " is-favorite" : ""}`}>
      {item.images.length > 0 && <Carousel images={item.images} title={item.title} />}
      <div className="edition-article__body">
        <p className="card__meta">
          {item.favorite && <span className="favorite-mark">★ Source favorite · </span>}
          {item.sourceName}
          {item.theme && <> · {item.theme}</>}
        </p>
        {item.placement === "une" ? <h2 className="edition-article__title">{item.title}</h2> : <h3 className="edition-article__title">{item.title}</h3>}
        {text && <p className="edition-article__text">{text}</p>}
        <a className="card__more" href={item.url} target="_blank" rel="noreferrer noopener">
          En savoir plus <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
