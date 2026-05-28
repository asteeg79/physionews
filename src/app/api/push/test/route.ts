import { db, schema } from '@/db';
import { sendPushToAllSubscriptions } from '@/lib/push-sender';

/**
 * Sendet eine Test-Push-Benachrichtigung an alle eingetragenen Subscriptions.
 * Wird vom „Test-Push senden"-Button in den Settings aufgerufen.
 *
 * Achtung: kein Cron-Secret nötig — diese Route ist absichtlich offen,
 * damit der Settings-Knopf ohne weiteres Setup funktioniert. Für ein
 * öffentliches Deployment (mehrere Nutzer) wäre eine Auth-Schicht nötig.
 */
export async function POST() {
  const subs = await db.select().from(schema.pushSubscriptions);
  if (subs.length === 0) {
    return Response.json(
      { ok: false, reason: 'no-subscriptions' },
      { status: 400 }
    );
  }

  await sendPushToAllSubscriptions({
    title: 'PhysioNews — Test-Benachrichtigung',
    body: 'Wenn du das siehst, sind Push-Benachrichtigungen korrekt eingerichtet.',
    url: '/',
  });

  return Response.json({ ok: true, sentTo: subs.length });
}
