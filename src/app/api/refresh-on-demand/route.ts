import { db, schema } from '@/db';
import { eq, lte } from 'drizzle-orm';
import { getBerlinHour } from '@/lib/timezone';
import { fetchAllSources } from '@/lib/feed-fetcher';
import { sendPushToAllSubscriptions } from '@/lib/push-sender';
import { selectAndPersistTopNews } from '@/lib/relevance/top-news';
import { rateLimit, clientIpFrom } from '@/lib/rate-limit';

/**
 * Refresh-on-Open Endpoint — vom Frontend aufgerufen, wenn die App geöffnet wird
 * und der letzte globale Refresh zu lange her ist.
 *
 * Unterschiede zum Cron-Endpoint:
 *  - kein X-Cron-Secret nötig
 *  - aggressives Rate-Limit (1× pro 5 Minuten pro IP)
 *  - prüft selbst, ob ein Refresh überhaupt nötig ist (Intervall-Check)
 */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  const limit = rateLimit(`refresh:${ip}`, { limit: 1, windowSeconds: 300 });
  if (!limit.allowed) {
    return Response.json(
      { skipped: true, reason: 'rate_limited', resetIn: limit.resetIn },
      { status: 429 }
    );
  }

  const [settings] = await db.select().from(schema.appSettings).limit(1);
  if (!settings) {
    return Response.json({ error: 'App-Einstellungen fehlen' }, { status: 500 });
  }

  // Refresh-Fenster prüfen (gleich wie Cron)
  const berlinHour = getBerlinHour();
  if (berlinHour < settings.refreshWindowStart || berlinHour >= settings.refreshWindowEnd) {
    return Response.json({ skipped: true, reason: 'outside_window', berlinHour });
  }

  // Intervall prüfen — nur refreshen, wenn lange genug her
  if (settings.lastGlobalRefreshAt) {
    const ageMs = Date.now() - settings.lastGlobalRefreshAt.getTime();
    const intervalMs = settings.refreshIntervalHours * 60 * 60 * 1000;
    if (ageMs < intervalMs) {
      return Response.json({
        skipped: true,
        reason: 'too_recent',
        lastRefreshAt: settings.lastGlobalRefreshAt.toISOString(),
        nextRefreshIn: Math.ceil((intervalMs - ageMs) / 1000),
      });
    }
  }

  console.log(`[OnDemand] Refresh angestoßen von ${ip}`);

  const { results, totalNew } = await fetchAllSources();

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
  }

  // Top-News-Auswahl analog zum Cron
  await selectAndPersistTopNews().catch((err) =>
    console.error('[OnDemand] Top-News-Auswahl fehlgeschlagen:', err)
  );

  await db
    .update(schema.appSettings)
    .set({ lastGlobalRefreshAt: new Date() })
    .where(eq(schema.appSettings.id, 1));

  // Aufräumen (gleich wie Cron)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.retentionDays);
  await db
    .delete(schema.newsItems)
    .where(lte(schema.newsItems.publishedAt, cutoff));

  return Response.json({
    ok: true,
    totalNew,
    sourcesChecked: results.length,
    triggeredBy: 'on-demand',
  });
}
