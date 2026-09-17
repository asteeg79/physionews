/**
 * Web-Push-Versand (VAPID, RFC 8030).
 *
 * Die Subscriptions liegen verschlüsselt in `data/push-subscriptions.enc.json`
 * (siehe data/push-subscriptions.ts). Geschrieben werden sie von der App
 * beim An-/Abmelden, gelesen von der App (Test-Push) und von der Pipeline
 * in GitHub Actions (Benachrichtigung über neue hochrelevante Items).
 */
import webpush from 'web-push';
import { loadNews, saveNews } from '@/data/news';
import { listSources } from '@/data/sources';
import { getSettings, updateSettings } from '@/data/settings';
import {
  listPushSubscriptions,
  removePushSubscriptions,
} from '@/data/push-subscriptions';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Eindeutiges Tag, damit sich Notifications auf iOS nicht überschreiben.
   *  Wenn nicht gesetzt, wird ein Zufalls-Tag generiert. */
  tag?: string;
}

let vapidReady = false;

/**
 * Setzt die VAPID-Details beim ersten Versand statt beim Import — sonst
 * würde jeder Import ohne gesetzte Keys sofort werfen, auch dort, wo gar
 * nicht gepusht wird.
 */
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[PushSender] VAPID-Keys fehlen — es wird nichts gesendet.');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidReady = true;
  return true;
}

/**
 * Sendet an alle hinterlegten Geräte. Endpoints, die mit 404/410 antworten,
 * sind abgelaufen und werden am Ende in einem Rutsch entfernt.
 */
export async function sendPushToAllSubscriptions(payload: PushPayload): Promise<number> {
  if (!ensureVapid()) return 0;

  const subscriptions = await listPushSubscriptions();
  if (subscriptions.length === 0) return 0;

  const fullPayload = {
    ...payload,
    tag: payload.tag ?? `physionews-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  const expired: string[] = [];
  let sent = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(fullPayload)
      );
      sent++;
    } catch (err) {
      const webpushErr = err as { statusCode?: number };
      if (webpushErr.statusCode === 410 || webpushErr.statusCode === 404) {
        expired.push(sub.endpoint);
        console.log(
          `[PushSender] Subscription abgelaufen (${webpushErr.statusCode}): ${sub.endpoint}`
        );
      } else {
        console.error(`[PushSender] Fehler beim Senden an ${sub.endpoint}:`, err);
      }
    }
  }

  // Ein einziger Schreibvorgang statt einer Datei-Änderung pro Endpoint.
  await removePushSubscriptions(expired);

  return sent;
}

/**
 * Notifiziert über NEUE hochrelevante Items — strikt einmal pro Item.
 *
 * Strategie (per-Item-Marker, robust gegen doppelte Läufe):
 *  - Auswahl: Items mit `notifiedAt === null`, Score >= threshold, aus
 *    Quellen mit aktivierten Benachrichtigungen, neueste zuerst
 *  - Limit `maxPushes` pro Aufruf (Sicherheitsdeckel gegen Spam)
 *  - `notifiedAt` wird VOR dem Versand gesetzt und gespeichert — egal ob
 *    der Versand selbst klappt (eine Bestätigung bekommen wir vom
 *    Push-Service ohnehin nicht)
 *  - Items über dem Limit bleiben `null` und kommen im nächsten Lauf dran
 *
 * Wenn `notificationsEnabled=false`: NICHTS wird gemacht. Items bleiben
 * `null` und werden gepusht, sobald Benachrichtigungen wieder aktiv sind.
 *
 * @returns Anzahl betrachteter Items und tatsächlich gesendeter Nachrichten
 */
export async function notifyNewHighRelevanceItems(opts: {
  threshold: number;
  /** App-weite Benachrichtigungs-Einstellung. */
  notificationsEnabled: boolean;
  /** Sicherheitsdeckel pro Aufruf (verhindert Spam bei Backfill). */
  maxPushes?: number;
}): Promise<{ pushSent: number; itemsConsidered: number }> {
  const maxPushes = opts.maxPushes ?? 10;

  // Wenn Benachrichtigungen global aus sind: gar nichts tun.
  if (!opts.notificationsEnabled) {
    return { pushSent: 0, itemsConsidered: 0 };
  }

  // Ohne angemeldetes Gerät gibt es nichts zu senden — und vor allem darf
  // dann auch `notifiedAt` nicht gesetzt werden. Sonst gälten die Items als
  // erledigt und würden nie nachgeholt, sobald sich das erste Gerät anmeldet.
  if ((await listPushSubscriptions()).length === 0) {
    return { pushSent: 0, itemsConsidered: 0 };
  }

  const news = await loadNews();
  const sources = await listSources();
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const candidates = news
    .filter((item) => {
      if (item.notifiedAt !== null) return false;
      if (item.relevanceScore < opts.threshold) return false;
      return sourceById.get(item.sourceId)?.notificationsEnabled === true;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, maxPushes);

  if (candidates.length === 0) {
    return { pushSent: 0, itemsConsidered: 0 };
  }

  // WICHTIG: Erst `notifiedAt` setzen und speichern, DANN senden. Startet
  // ein weiterer Lauf parallel, sieht der diese Items bereits als
  // notifiziert und überspringt sie — Doppel-Pushes sind damit
  // ausgeschlossen.
  const now = new Date();
  for (const item of candidates) {
    item.notifiedAt = now;
  }
  await saveNews(news, 'chore(data): Push-Markierungen gesetzt');

  let pushSent = 0;
  for (const item of candidates) {
    const sourceName = sourceById.get(item.sourceId)?.name ?? 'PhysioNews';
    try {
      // Zählt die tatsächlich zugestellten Nachrichten, nicht die Anzahl
      // der Items — bei zwei Geräten sind das pro Item zwei.
      pushSent += await sendPushToAllSubscriptions({
        title: sourceName,
        body: item.title,
        url: item.url,
      });
    } catch (err) {
      // Ein einzelner Push-Fehler darf den ganzen Lauf nicht abbrechen.
      // `notifiedAt` bleibt gesetzt — ein Retry würde sonst doppelt pushen.
      console.error('[Notify] Push fehlgeschlagen für item', item.id, err);
    }
  }

  // Zeitpunkt als Sekundär-Marker mitführen (die Settings-Seite zeigt ihn an).
  const settings = await getSettings();
  if (settings.lastNotifiedAt?.getTime() !== now.getTime()) {
    await updateSettings({ lastNotifiedAt: now });
  }

  return { pushSent, itemsConsidered: candidates.length };
}
