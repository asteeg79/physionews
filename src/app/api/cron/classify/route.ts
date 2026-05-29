/**
 * Cron-Endpoint: Klassifizierung + Push.
 *
 * Aufgaben:
 *  - Alle Items mit relevance_method='pending' bewerten (Keyword + ggf. Gemini)
 *  - Items mit Score < 4 werden gelöscht
 *  - Für jedes Item mit Score >= 9 eine eigene Push-Notification senden
 *
 * Läuft nach /api/cron/fetch (siehe GitHub-Actions-Workflow).
 */

import { db, schema } from '@/db';
import { eq, gte, and } from 'drizzle-orm';
import { classifyPendingItems } from '@/lib/relevance';
import { sendPushToAllSubscriptions } from '@/lib/push-sender';
import { checkCronSecret } from '@/lib/cron-auth';
import { checkWindow } from '@/lib/cron-window';

export const maxDuration = 60;

/** Mindest-Score für eine eigene Push-Benachrichtigung. */
const PUSH_RELEVANCE_THRESHOLD = 9;

export async function POST(req: Request) {
  const authFail = checkCronSecret(req);
  if (authFail) return authFail;

  const win = await checkWindow();
  if (!win) {
    return Response.json({ error: 'App-Einstellungen fehlen' }, { status: 500 });
  }
  if (!win.inWindow) {
    return Response.json({ skipped: true, reason: 'outside_window', berlinHour: win.berlinHour });
  }

  console.log(`[Cron:Classify] Start (${win.berlinHour}h Berlin)`);

  // Marker für die Push-Auswahl: alles was nach diesem Zeitpunkt klassifiziert
  // wird, ist „frisch klassifiziert" (nicht: frisch fetched).
  const classifyStartedAt = new Date();

  const classify = await classifyPendingItems();
  console.log(
    `[Cron:Classify] ${classify.total} klassifiziert (keyword: ${classify.byMethod.keyword}, ` +
      `ai: ${classify.byMethod.ai}, gelöscht: ${classify.deletedBelowThreshold}, ` +
      `gemini batches: ${classify.geminiBatches}, ~tokens: ${classify.geminiTokensEstimated})`
  );

  // Push für hochrelevante neu klassifizierte Items
  let pushSent = 0;
  if (classify.total > 0 && win.settings.notificationsEnabled) {
    // Items die in diesem Lauf klassifiziert wurden und den Schwellwert reißen.
    // Wir nutzen fetchedAt als Surrogat — Items wurden seit dem letzten Cron-Run
    // inserted, bevor sie klassifiziert werden konnten.
    const highRelevanceItems = await db
      .select({
        title: schema.newsItems.title,
        url: schema.newsItems.url,
        sourceName: schema.sources.name,
        sourceNotifications: schema.sources.notificationsEnabled,
      })
      .from(schema.newsItems)
      .innerJoin(schema.sources, eq(schema.newsItems.sourceId, schema.sources.id))
      .where(
        and(
          gte(schema.newsItems.relevanceScore, PUSH_RELEVANCE_THRESHOLD),
          gte(schema.newsItems.fetchedAt, new Date(classifyStartedAt.getTime() - 1000 * 60 * 30)),
          eq(schema.sources.notificationsEnabled, true)
        )
      )
      .limit(10);

    for (const item of highRelevanceItems) {
      if (!item.sourceNotifications) continue;
      await sendPushToAllSubscriptions({
        title: item.sourceName,
        body: item.title,
        url: item.url,
      });
      pushSent++;
    }
    console.log(
      `[Cron:Classify] ${pushSent} Push-Benachrichtigungen versendet ` +
        `(Schwellwert: Score >= ${PUSH_RELEVANCE_THRESHOLD}).`
    );
  }

  return Response.json({
    ok: true,
    classify: {
      total: classify.total,
      byMethod: classify.byMethod,
      deletedBelowThreshold: classify.deletedBelowThreshold,
      geminiBatches: classify.geminiBatches,
      tokens: classify.geminiTokensEstimated,
    },
    pushSent,
  });
}
