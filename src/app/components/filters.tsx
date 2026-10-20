import Link from "next/link";
import type { Source } from "@/db/schema";

const TYPE_LABELS: Record<Source["type"], string> = {
  web: "Sites web",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
};

/** Filters by type of media and by source. Plain links: the filter lives in the address (?type=web, ?source=5). */
export function Filters({
  sources,
  type,
  sourceId,
}: {
  sources: Pick<Source, "id" | "displayName" | "type">[];
  type?: Source["type"];
  sourceId?: number;
}) {
  const types = [...new Set(sources.map((source) => source.type))];
  const shown = sources.filter((source) => !type || source.type === type);
  const all = !type && sourceId === undefined;

  return (
    <nav className="filters" aria-label="Filtres">
      <div className="filters__row">
        <Link href="/" className="chip" aria-current={all ? "page" : undefined}>
          Tout
        </Link>
        {types.length > 1 &&
          types.map((value) => (
            <Link key={value} href={`/?type=${value}`} className="chip" aria-current={type === value && sourceId === undefined ? "page" : undefined}>
              {TYPE_LABELS[value]}
            </Link>
          ))}
      </div>
      <div className="filters__row">
        {shown.map((source) => (
          <Link
            key={source.id}
            href={`/?source=${source.id}`}
            className="chip chip--small"
            aria-current={sourceId === source.id ? "page" : undefined}
          >
            {source.displayName}
          </Link>
        ))}
      </div>
    </nav>
  );
}
