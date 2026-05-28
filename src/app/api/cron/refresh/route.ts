import { db, schema } from '@/db';
import { eq, lte } from 'drizzle-orm';
import { getBerlinHour } from '@/lib/timezone';
import { fetchAllSources } from '@/lib/feed-fetcher';
import { sendPushToAllSubscriptions } from '@/lib/push-sender';

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

  const { results, totalNew } = await fetchAllSources();

  // Web Push, wenn neue Items vorhanden und Benachrichtigungen aktiv
  if (totalNew > 0 && settings.notificationsEnabled) {
    const sourcesWithNew = results.filter((r) => r.newItems > 0);
    const topTitles = sourcesWithNew
      .slice(0, 3)
      .map((r) => `• ${r.sourceName}`)
      .join('\n');

    await sendPushToAllSubscriptions({
      title: `PhysioNews — ${totalNew} neue Beiträge`,
      body: topTitles,
      url: '/',
    });
    console.log(`[Cron] Push gesendet für ${totalNew} neue Items.`);
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
