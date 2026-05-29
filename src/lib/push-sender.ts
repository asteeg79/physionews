import webpush from 'web-push';
import { eq, gt, gte, and } from 'drizzle-orm';
import { db, schema } from '@/db';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Eindeutiges Tag, damit sich Notifications auf iOS nicht überschreiben.
   *  Wenn nicht gesetzt, wird ein Zufalls-Tag generiert. */
  tag?: string;
}

export async function sendPushToAllSubscriptions(payload: PushPayload): Promise<void> {
  const subscriptions = await db.select().from(schema.pushSubscriptions);

  const fullPayload = {
    ...payload,
    tag: payload.tag ?? `physionews-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        },
        JSON.stringify(fullPayload)
      );
    } catch (err) {
      const webpushErr = err as { statusCode?: number };
      if (webpushErr.statusCode === 410 || webpushErr.statusCode === 404) {
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.endpoint, sub.endpoint));
        console.log(`[PushSender] Subscription entfernt (${webpushErr.statusCode}): ${sub.endpoint}`);
      } else {
        console.error(`[PushSender] Fehler beim Senden an ${sub.endpoint}:`, err);
      }
    }
  }
}

/**
 * Notifiziert über NEUE hochrelevante Items — strikt idempotent.
 *
 * Strategie:
 *  - Liest `app_settings.last_notified_at` als Cutoff
 *  - Selektiert Items mit `fetched_at > last_notified_at`, Score >= threshold,
 *    aus Quellen mit Notifications aktiv
 *  - Sendet pro Item eine eigene Notification (max `maxPushes`)
 *  - Setzt `last_notified_at` auf den Zeitpunkt JETZT (vor dem Fetch-Cutoff
 *    der nächsten Runde) — egal ob etwas gesendet wurde oder nicht.
 *    Damit kann dasselbe Item NIE zweimal gepusht werden.
 *
 * Wird vom classify- und refresh-Cron sowie vom refresh-on-demand-Endpoint
 * aufgerufen. Wenn die User-Settings notifications deaktivieren, wird der
 * Cutoff trotzdem aktualisiert (Backlog würde sonst beim Reaktivieren als
 * „neu" gelten).
 *
 * @returns Anzahl tatsächlich gesendeter Notifications
 */
export async function notifyNewHighRelevanceItems(opts: {
  threshold: number;
  /** App-weite Notifications-Einstellung — entscheidet, ob tatsächlich gesendet wird. */
  notificationsEnabled: boolean;
  /** Sicherheitsdeckel pro Aufruf (verhindert Spam bei Backfill). */
  maxPushes?: number;
}): Promise<{ pushSent: number; cutoffUsed: Date; itemsConsidered: number }> {
  const maxPushes = opts.maxPushes ?? 10;
  const now = new Date();

  const [settings] = await db.select().from(schema.appSettings).limit(1);
  // Fallback: wenn noch nie notifiziert, nur Items der letzten Stunde —
  // beim allerersten Lauf nicht den kompletten Backlog rauspushen.
  const cutoff = settings?.lastNotifiedAt ?? new Date(now.getTime() - 60 * 60 * 1000);

  const candidates = await db
    .select({
      title: schema.newsItems.title,
      url: schema.newsItems.url,
      fetchedAt: schema.newsItems.fetchedAt,
      sourceName: schema.sources.name,
    })
    .from(schema.newsItems)
    .innerJoin(schema.sources, eq(schema.newsItems.sourceId, schema.sources.id))
    .where(
      and(
        gt(schema.newsItems.fetchedAt, cutoff),
        gte(schema.newsItems.relevanceScore, opts.threshold),
        eq(schema.sources.notificationsEnabled, true)
      )
    )
    .limit(maxPushes);

  let pushSent = 0;
  if (opts.notificationsEnabled) {
    for (const item of candidates) {
      await sendPushToAllSubscriptions({
        title: item.sourceName,
        body: item.title,
        url: item.url,
      });
      pushSent++;
    }
  }

  // Cutoff IMMER hochziehen — auch wenn nicht gesendet wurde (z. B. Notifications
  // aus). Sonst würden beim Reaktivieren alte Items als „neu" gepusht.
  await db.update(schema.appSettings).set({ lastNotifiedAt: now }).where(eq(schema.appSettings.id, 1));

  return { pushSent, cutoffUsed: cutoff, itemsConsidered: candidates.length };
}
