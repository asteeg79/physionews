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

import { classifyPendingItems } from '@/lib/relevance';
import { notifyNewHighRelevanceItems } from '@/lib/push-sender';
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

  // 150 Items pro Aufruf — hält uns sicher unter 60s Vercel-Function-Timeout.
  // Bei mehr ruft GitHub Actions den Endpoint mehrfach auf (siehe workflow).
  const CHUNK_SIZE = 150;
  const classify = await classifyPendingItems(CHUNK_SIZE);
  console.log(
    `[Cron:Classify] ${classify.total} klassifiziert (keyword: ${classify.byMethod.keyword}, ` +
      `ai: ${classify.byMethod.ai}, gelöscht: ${classify.deletedBelowThreshold}, ` +
      `gemini batches: ${classify.geminiBatches}, ~tokens: ${classify.geminiTokensEstimated}, ` +
      `remaining: ${classify.remaining})`
  );

  // Push für hochrelevante NEUE Items (idempotent via app_settings.last_notified_at).
  // Mehrfache classify-Aufrufe pro Refresh-Zyklus pushen dasselbe Item NIE doppelt,
  // weil der Helper den Cutoff atomar hochzieht.
  const notify = await notifyNewHighRelevanceItems({
    threshold: PUSH_RELEVANCE_THRESHOLD,
    notificationsEnabled: win.settings.notificationsEnabled,
  });
  console.log(
    `[Cron:Classify] Push: ${notify.pushSent} gesendet ` +
      `(${notify.itemsConsidered} Kandidaten, cutoff war ${notify.cutoffUsed.toISOString()}, Schwellwert >= ${PUSH_RELEVANCE_THRESHOLD}).`
  );

  return Response.json({
    ok: true,
    classify: {
      total: classify.total,
      byMethod: classify.byMethod,
      deletedBelowThreshold: classify.deletedBelowThreshold,
      geminiBatches: classify.geminiBatches,
      tokens: classify.geminiTokensEstimated,
      cacheHits: classify.cacheHits,
      quotaThrottled: classify.quotaThrottled,
    },
    pushSent: notify.pushSent,
    /**
     * Wenn > 0, sollte der Workflow classify nochmal aufrufen.
     * Bei `quotaThrottled=true` wird 0 zurückgegeben (auch wenn pending
     * Items übrig sind) — sonst hagelt der nächste Loop-Aufruf wieder
     * nur 429er. Die Items bleiben pending und werden im NÄCHSTEN
     * Cron-Zyklus (2 h später) nachgeholt.
     */
    remaining: classify.quotaThrottled ? 0 : classify.remaining,
  });
}
