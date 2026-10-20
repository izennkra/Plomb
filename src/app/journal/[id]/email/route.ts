import { and, eq } from "drizzle-orm";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { editions } from "@/db/schema";
import { renderEditionEmail } from "@/modules/edition/email";
import { getEditionItems } from "@/modules/edition/list";

/** Preview of the 9:00 e-mail of an edition, as it will be received. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = await getDb();
  const edition = Number.isInteger(id)
    ? await db.query.editions.findFirst({ where: and(eq(editions.id, id), eq(editions.userId, DEFAULT_USER_ID)) })
    : undefined;
  if (!edition) return new Response("Édition introuvable", { status: 404 });

  const journalUrl = new URL(`/journal?edition=${edition.id}`, request.url).toString();
  const email = renderEditionEmail(edition, await getEditionItems(db, edition.id), { journalUrl });
  return new Response(email.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
