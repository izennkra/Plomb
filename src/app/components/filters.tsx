import Link from "next/link";
import type { Source } from "@/db/schema";

const TYPE_LABELS: Record<Source["type"], string> = {
  web: "Sites",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
};

/**
 * Small tags above the column: all, or one kind of media. A single source (chosen on the Sources page) shows as
 * its own tag, with × to come back to everything. The filter lives in the address (?type=web, ?source=5).
 */
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
  const source = sources.find((candidate) => candidate.id === sourceId);
  const all = !type && !source;

  return (
    <nav className="filters" aria-label="Filtres">
      <Link href="/depeches" className="chip" aria-current={all ? "page" : undefined}>
        Tout
      </Link>
      {types.length > 1 &&
        types.map((value) => (
          <Link key={value} href={`/depeches?type=${value}`} className="chip" aria-current={type === value && !source ? "page" : undefined}>
            {TYPE_LABELS[value]}
          </Link>
        ))}
      {source && (
        <Link href="/depeches" className="chip" aria-current="page" aria-label={`${source.displayName} — retirer le filtre`}>
          {source.displayName} <span aria-hidden="true">×</span>
        </Link>
      )}
    </nav>
  );
}
