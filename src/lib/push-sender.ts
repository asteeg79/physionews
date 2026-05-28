import webpush from 'web-push';
import { eq } from 'drizzle-orm';
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
}

export async function sendPushToAllSubscriptions(payload: PushPayload): Promise<void> {
  const subscriptions = await db.select().from(schema.pushSubscriptions);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        },
        JSON.stringify(payload)
      );
    } catch (err) {
      const webpushErr = err as { statusCode?: number };
      // Abgelaufene oder ungültige Subscription entfernen
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
