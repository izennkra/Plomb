import type { EditionItem } from "@/db/schema";
import { imageRatio, type Slot } from "@/modules/edition/layout";
import { Carousel } from "./carousel";

/** A window of the journal: a grey frame with its source on top, its picture, its title and summary. */
export function EditionWindow({ item, slot }: { item: EditionItem; slot: Slot }) {
  return (
    <div className="journal-grid__cell" style={{ gridColumn: `${slot.column} / span ${slot.span}` }} data-span={slot.span}>
      <article className={`window${item.favorite ? " window--favorite" : ""}`} style={{ "--ratio": imageRatio(slot.span) } as React.CSSProperties}>
        <p className="window__label">
          <span>{item.sourceName}</span>
          {item.coveredBy.length > 0 && (
            <span className="window__tag" title={`Aussi chez ${item.coveredBy.join(", ")}`}>
              {item.coveredBy.length + 1} médias
            </span>
          )}
          {item.favorite && <span className="window__tag">★</span>}
        </p>
        {item.images.length > 0 && <Carousel images={item.images} title={item.title} />}
        <div className="window__body">
          <h3 className="window__title">{item.title}</h3>
          {item.summary && <p className="window__text">{item.summary}</p>}
          <a className="window__more" href={item.url} target="_blank" rel="noreferrer noopener">
            En savoir plus
          </a>
        </div>
      </article>
    </div>
  );
}

/** The unfolded Une: its longer text, pictures and link. */
export function UneDetails({ item }: { item: EditionItem }) {
  return (
    <>
      {item.images.length > 0 && <Carousel images={item.images} title={item.title} />}
      <p className="une__text">{item.leadText ?? item.summary}</p>
      <p className="une__meta">
        {item.sourceName}
        {item.coveredBy.length > 0 && <> · couvert par {item.coveredBy.length + 1} médias</>}
        {" · "}
        <a href={item.url} target="_blank" rel="noreferrer noopener">
          En savoir plus
        </a>
      </p>
    </>
  );
}
