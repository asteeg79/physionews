import webpush from 'web-push';
import { eq, gte, and, desc, isNull, inArray } from 'drizzle-orm';
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
 * Notifiziert über NEUE hochrelevante Items — strikt einmal pro Item.
 *
 * Strategie (per-Item-Marker, robust gegen Race-Conditions):
 *  - Selektiert Items mit `notified_at IS NULL`, Score >= threshold,
 *    aus Quellen mit Notifications aktiv, sortiert nach Aktualität (DESC)
 *  - Limit `maxPushes` pro Aufruf (Sicherheitsdeckel gegen Spam)
 *  - Sendet pro Item eine eigene Notification
 *  - Setzt `notified_at = NOW()` für die JEWEILS gepushten Items —
 *    egal ob der Versand selbst erfolgreich war (web-push-Service ist
 *    asynchron, eine Bestätigung bekommen wir ohnehin nicht)
 *  - Items über das Limit hinaus bleiben `notified_at = NULL` und
 *    werden im nächsten Cron-Lauf nachgeholt — keine Information geht
 *    mehr verloren wie bei der alten cutoff-Logik
 *
 * Wenn `notificationsEnabled=false`: NICHTS wird gemacht. Items bleiben
 * NULL und werden gepusht, sobald Notifications wieder aktiviert sind.
 *
 * Bei Bedarf später: `app_settings.last_notified_at` kann als Fallback-
 * Cutoff weiter aktualisiert werden, ist aber kein primärer Mechanismus mehr.
 *
 * @returns Anzahl tatsächlich gesendeter Notifications
 */
export async function notifyNewHighRelevanceItems(opts: {
  threshold: number;
  /** App-weite Notifications-Einstellung — entscheidet, ob tatsächlich gesendet wird. */
  notificationsEnabled: boolean;
  /** Sicherheitsdeckel pro Aufruf (verhindert Spam bei Backfill). */
  maxPushes?: number;
}): Promise<{ pushSent: number; itemsConsidered: number }> {
  const maxPushes = opts.maxPushes ?? 10;

  // Wenn Notifications global aus: gar nichts tun. Items bleiben
  // notified_at=NULL und werden gepusht, wenn der User wieder aktiviert.
  if (!opts.notificationsEnabled) {
    return { pushSent: 0, itemsConsidered: 0 };
  }

  const candidates = await db
    .select({
      id: schema.newsItems.id,
      title: schema.newsItems.title,
      url: schema.newsItems.url,
      publishedAt: schema.newsItems.publishedAt,
      sourceName: schema.sources.name,
    })
    .from(schema.newsItems)
    .innerJoin(schema.sources, eq(schema.newsItems.sourceId, schema.sources.id))
    .where(
      and(
        isNull(schema.newsItems.notifiedAt),
        gte(schema.newsItems.relevanceScore, opts.threshold),
        eq(schema.sources.notificationsEnabled, true)
      )
    )
    .orderBy(desc(schema.newsItems.publishedAt))
    .limit(maxPushes);

  if (candidates.length === 0) {
    return { pushSent: 0, itemsConsidered: 0 };
  }

  // WICHTIG: Erst notified_at setzen, DANN senden. Falls der Push ein paar
  // Sekunden braucht und ein weiterer Cron-Lauf parallel startet, sieht der
  // diese Items schon als "notifiziert" und überspringt sie. Damit ist
  // Double-Push auch bei paralleler Ausführung ausgeschlossen.
  const now = new Date();
  await db
    .update(schema.newsItems)
    .set({ notifiedAt: now })
    .where(
      inArray(
        schema.newsItems.id,
        candidates.map((c) => c.id)
      )
    );

  let pushSent = 0;
  for (const item of candidates) {
    try {
      await sendPushToAllSubscriptions({
        title: item.sourceName,
        body: item.title,
        url: item.url,
      });
      pushSent++;
    } catch (err) {
      // Ein einzelner Push-Fehler darf den ganzen Lauf nicht crashen.
      // notified_at bleibt gesetzt — wir wollen nicht riskieren, dass
      // ein Retry zu Doppel-Pushes führt.
      console.error('[Notify] Push fehlgeschlagen für item', item.id, err);
    }
  }

  // Cutoff in app_settings als Sekundär-Marker mitführen (Settings-UI
  // zeigt ihn an).
  await db
    .update(schema.appSettings)
    .set({ lastNotifiedAt: now })
    .where(eq(schema.appSettings.id, 1));

  return { pushSent, itemsConsidered: candidates.length };
}
