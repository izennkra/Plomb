import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import type { Source } from "@/db/schema";
import { listSources } from "@/modules/sources/list-sources";
import { unsubscribeAction } from "./actions";
import { AddSourceForm } from "./add-source-form";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<Source["type"], string> = {
  web: "Site web",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
};

export default async function SourcesPage() {
  const sources = await listSources(await getDb(), DEFAULT_USER_ID);

  return (
    <main>
      <h1>Plomb — Sources</h1>
      <AddSourceForm />

      <h2>Mes sources ({sources.length})</h2>
      {sources.length === 0 ? (
        <p>Aucune source pour l&apos;instant. Collez le lien d&apos;un site, d&apos;un compte Instagram, X ou LinkedIn.</p>
      ) : (
        <ul>
          {sources.map((source) => (
            <li key={source.id}>
              <span>{TYPE_LABELS[source.type]}</span> —{" "}
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.displayName}
              </a>{" "}
              <form action={unsubscribeAction} style={{ display: "inline" }}>
                <input type="hidden" name="sourceId" value={source.id} />
                <button type="submit" aria-label={`Retirer ${source.displayName}`}>
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
