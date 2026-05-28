import { db, schema } from '@/db';
import { eq, lte, gte, and, desc } from 'drizzle-orm';
import { getBerlinHour } from '@/lib/timezone';
import { fetchAllSources } from '@/lib/feed-fetcher';
import { sendPushToAllSubscriptions } from '@/lib/push-sender';

// Nur Items mit dieser Mindest-Relevanz lösen eine eigene Push aus.
// 9-10 = direkter Physio-Praxis-Bezug nach unserer Bewertungs-Rubric.
const PUSH_RELEVANCE_THRESHOLD = 9;

export async function POST(req: Request) {
  // Authentifizierung
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const [settings] = await db.select().from(schema.appSettings).limit(1);
  if (!settings) {
    return Response.json({ error: 'App-Einstellungen fehlen' }, { status: 500 });
  }

  // Zeitfenster prüfen (Europe/Berlin)
  const berlinHour = getBerlinHour();
  if (berlinHour < settings.refreshWindowStart || berlinHour >= settings.refreshWindowEnd) {
    console.log(`[Cron] Außerhalb des Refresh-Fensters (${berlinHour}:xx Uhr Berlin) — übersprungen.`);
    return Response.json({ skipped: true, reason: 'outside_window', berlinHour });
  }

  console.log(`[Cron] Starte Refresh (${berlinHour}:xx Uhr Berlin)...`);

  // Zeitpunkt VOR dem Fetch merken, damit wir nur die wirklich neu eingefügten
  // hochrelevanten Items für Push-Notifications heranziehen
  const fetchStartedAt = new Date();

  const { results, totalNew } = await fetchAllSources();

  // Web Push: für JEDES neue Item mit Relevanz >= PUSH_RELEVANCE_THRESHOLD
  // eine eigene Notification senden. Items mit niedriger Relevanz lösen
  // keine Benachrichtigung aus.
  let pushSent = 0;
  if (totalNew > 0 && settings.notificationsEnabled) {
    const highRelevanceItems = await db
      .select({
        id: schema.newsItems.id,
        title: schema.newsItems.title,
        url: schema.newsItems.url,
        relevanceScore: schema.newsItems.relevanceScore,
        sourceName: schema.sources.name,
        sourceNotifications: schema.sources.notificationsEnabled,
      })
      .from(schema.newsItems)
      .innerJoin(schema.sources, eq(schema.newsItems.sourceId, schema.sources.id))
      .where(
        and(
          gte(schema.newsItems.fetchedAt, fetchStartedAt),
          gte(schema.newsItems.relevanceScore, PUSH_RELEVANCE_THRESHOLD),
          eq(schema.sources.notificationsEnabled, true)
        )
      )
      .orderBy(desc(schema.newsItems.relevanceScore))
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
      `[Cron] ${pushSent} hochrelevante Push-Benachrichtigungen versendet ` +
        `(Schwellwert: Score >= ${PUSH_RELEVANCE_THRESHOLD}).`
    );
  }

  // lastGlobalRefreshAt aktualisieren
  await db
    .update(schema.appSettings)
    .set({ lastGlobalRefreshAt: new Date() })
    .where(eq(schema.appSettings.id, 1));

  // Aufräumen: alte Items löschen
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.retentionDays);
  const deleted = await db
    .delete(schema.newsItems)
    .where(lte(schema.newsItems.publishedAt, cutoff))
    .returning({ id: schema.newsItems.id });

  console.log(`[Cron] ${deleted.length} alte Items gelöscht (> ${settings.retentionDays} Tage).`);

  return Response.json({
    ok: true,
    totalNew,
    sourcesChecked: results.length,
    errors: results.filter((r) => r.error).map((r) => ({ source: r.sourceName, error: r.error })),
    deletedOldItems: deleted.length,
  });
}
