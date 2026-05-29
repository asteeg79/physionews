/**
 * Legacy-Cron-Endpoint — ruft die drei neuen Stufen nacheinander auf.
 *
 * Bleibt für Manuelles-Triggern (z.B. via curl) und für Setups, bei denen
 * GitHub Actions noch nicht auf den neuen Workflow umgestellt ist.
 *
 * In Production wird der Workflow direkt fetch → classify → maintenance
 * aufrufen, damit jeder Schritt sein eigenes 60s-Function-Timeout-Budget hat.
 */

import { fetchAllSources } from '@/lib/feed-fetcher';
import { classifyPendingItems } from '@/lib/relevance';
import { selectAndPersistTopNews } from '@/lib/relevance/top-news';
import { db, schema } from '@/db';
import { eq, lte, gte, and } from 'drizzle-orm';
import { sendPushToAllSubscriptions } from '@/lib/push-sender';
import { checkCronSecret } from '@/lib/cron-auth';
import { checkWindow } from '@/lib/cron-window';

export const maxDuration = 60;

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

  console.log(`[Cron:Legacy] Komplettlauf (${win.berlinHour}h)`);

  // 1. Fetch
  const fetchStartedAt = new Date();
  const { results, totalNew } = await fetchAllSources();

  // 2. Classify
  const classify = await classifyPendingItems();

  // 3. Push für hochrelevante Items
  let pushSent = 0;
  if (totalNew > 0 && win.settings.notificationsEnabled) {
    const highRel = await db
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
          gte(schema.newsItems.fetchedAt, fetchStartedAt),
          gte(schema.newsItems.relevanceScore, PUSH_RELEVANCE_THRESHOLD),
          eq(schema.sources.notificationsEnabled, true)
        )
      )
      .limit(10);
    for (const item of highRel) {
      if (!item.sourceNotifications) continue;
      await sendPushToAllSubscriptions({
        title: item.sourceName,
        body: item.title,
        url: item.url,
      });
      pushSent++;
    }
  }

  // 4. Retention-Cleanup
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - win.settings.retentionDays);
  const deleted = await db
    .delete(schema.newsItems)
    .where(lte(schema.newsItems.publishedAt, cutoff))
    .returning({ id: schema.newsItems.id });

  // 5. Top-News
  await db
    .update(schema.appSettings)
    .set({ lastGlobalRefreshAt: new Date() })
    .where(eq(schema.appSettings.id, 1));

  let topNewsInfo = { selected: 0, usedAi: false, pool: 0, tokens: 0 };
  try {
    const tn = await selectAndPersistTopNews();
    topNewsInfo = {
      selected: tn.selectedIds.length,
      usedAi: tn.usedAi,
      pool: tn.poolSize,
      tokens: tn.tokensEstimated,
    };
  } catch (err) {
    console.error('[Cron:Legacy] Top-News-Auswahl fehlgeschlagen:', err);
  }

  return Response.json({
    ok: true,
    totalNew,
    sourcesChecked: results.length,
    errors: results.filter((r) => r.error).map((r) => ({ source: r.sourceName, error: r.error })),
    classified: classify.total,
    pushSent,
    deletedOldItems: deleted.length,
    topNews: topNewsInfo,
  });
}
