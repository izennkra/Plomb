import { getDb } from "@/db";
import { getRedacteur } from "@/modules/edition/redacteur";
import { isClockAuthorized } from "@/modules/planification/clock-auth";
import { runClock } from "@/modules/planification/clock";
import { createResendSender } from "@/modules/planification/resend-sender";

// The online host stops a call after 5 minutes; the clock keeps a margin.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Called every 15 minutes by cron-job.org: prepares the edition (8:00), publishes and e-mails it (9:00),
 * alerts if it failed, and reads the sources. Protected by the CRON_SECRET token.
 */
async function handle(request: Request): Promise<Response> {
  if (!isClockAuthorized(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "Accès refusé." }, { status: 401 });
  }

  const appUrl = process.env.PLOMB_APP_URL ?? new URL(request.url).origin;
  const report = await runClock(await getDb(), {
    redacteur: getRedacteur,
    sendEmail: (message) => createResendSender({ apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.PLOMB_EMAIL_FROM })(message),
    emailTo: process.env.PLOMB_EMAIL_TO ?? "",
    journalUrl: `${appUrl}/journal`,
  });
  return Response.json(report);
}

export const GET = handle;
export const POST = handle;
