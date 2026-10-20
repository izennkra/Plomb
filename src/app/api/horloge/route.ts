import { after } from "next/server";
import { getDb } from "@/db";
import { getRedacteur } from "@/modules/edition/redacteur";
import { isClockAuthorized } from "@/modules/planification/clock-auth";
import { runClock } from "@/modules/planification/clock";
import { createResendSender } from "@/modules/planification/resend-sender";
import { createApifyClient } from "@/modules/social/apify";
import { createDbMediaStore } from "@/modules/social/media-store";

// The online host stops a call after 5 minutes; the clock keeps a margin.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Called every 15 minutes by cron-job.org (answers at once, works behind): prepares the edition (8:00), publishes and e-mails it (9:00),
 * alerts if it failed, and reads the sources. Protected by the CRON_SECRET token.
 */
async function handle(request: Request): Promise<Response> {
  if (!isClockAuthorized(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "Accès refusé." }, { status: 401 });
  }

  const url = new URL(request.url);
  const appUrl = process.env.PLOMB_APP_URL ?? url.origin;
  const db = await getDb();
  const run = () => runClock(db, {
    redacteur: getRedacteur,
    sendEmail: (message) => createResendSender({ apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.PLOMB_EMAIL_FROM })(message),
    emailTo: process.env.PLOMB_EMAIL_TO ?? "",
    journalUrl: `${appUrl}/journal`,
    apify: () => (process.env.APIFY_TOKEN ? createApifyClient({ token: process.env.APIFY_TOKEN }) : null),
    mediaStore: createDbMediaStore(db),
  });

  // cron-job.org gives up after 30 seconds: it gets its answer at once, the work goes on behind (up to 5 minutes;
  // the report is in Vercel's logs). "?attendre=1" waits for the report (manual checks).
  if (url.searchParams.has("attendre")) return Response.json(await run());
  after(async () => console.log("Horloge :", JSON.stringify(await run())));
  return Response.json({ started: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
