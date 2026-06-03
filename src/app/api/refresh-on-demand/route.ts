import { db, schema } from '@/db';
import { and, eq, lte, notInArray } from 'drizzle-orm';
import { isHighlightedSourceName } from '@/lib/highlighted-sources';
import { getBerlinHour } from '@/lib/timezone';
import { fetchAllSources } from '@/lib/feed-fetcher';
import { notifyNewHighRelevanceItems } from '@/lib/push-sender';
import { selectAndPersistTopNews } from '@/lib/relevance/top-news';
import { rateLimit, clientIpFrom } from '@/lib/rate-limit';

const PUSH_RELEVANCE_THRESHOLD = 9;

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

  // Push nur für tatsächlich NEUE hochrelevante Items — idempotent.
  // (Kein „X neue Beiträge"-Summary mehr — die App ist beim On-Demand-Refresh
  // ohnehin im Vordergrund, ein Banner darüber wäre redundantes Rauschen.)
  await notifyNewHighRelevanceItems({
    threshold: PUSH_RELEVANCE_THRESHOLD,
    notificationsEnabled: settings.notificationsEnabled,
  });

  await db
    .update(schema.appSettings)
    .set({ lastGlobalRefreshAt: new Date() })
    .where(eq(schema.appSettings.id, 1));

  // Aufräumen MUSS VOR der Top-News-Auswahl laufen.
  // Highlighted Quellen (RA Alt etc.) sind von Retention ausgenommen,
  // siehe lib/highlighted-sources.ts.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.retentionDays);
  const allSrc = await db
    .select({ id: schema.sources.id, name: schema.sources.name })
    .from(schema.sources);
  const protectedIds = allSrc.filter((s) => isHighlightedSourceName(s.name)).map((s) => s.id);
  const conds = [lte(schema.newsItems.publishedAt, cutoff)];
  if (protectedIds.length > 0) {
    conds.push(notInArray(schema.newsItems.sourceId, protectedIds));
  }
  await db.delete(schema.newsItems).where(and(...conds));

  // Top-News-Auswahl analog zum Cron
  await selectAndPersistTopNews().catch((err) =>
    console.error('[OnDemand] Top-News-Auswahl fehlgeschlagen:', err)
  );

  return Response.json({
    ok: true,
    totalNew,
    sourcesChecked: results.length,
    triggeredBy: 'on-demand',
  });
}
