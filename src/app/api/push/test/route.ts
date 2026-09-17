import { listPushSubscriptions } from '@/data/push-subscriptions';
import { sendPushToAllSubscriptions } from '@/lib/push-sender';

/**
 * Sendet eine Test-Push-Benachrichtigung an alle angemeldeten Geräte.
 * Wird vom „Test-Push senden"-Button in den Einstellungen aufgerufen.
 *
 * Achtung: kein Cron-Secret nötig — diese Route ist absichtlich offen,
 * damit der Knopf ohne weiteres Setup funktioniert. Für ein öffentliches
 * Deployment (mehrere Nutzer) wäre eine Auth-Schicht nötig.
 */
export const dynamic = 'force-dynamic';

export async function POST() {
  const subs = await listPushSubscriptions();
  if (subs.length === 0) {
    return Response.json({ ok: false, reason: 'no-subscriptions' }, { status: 400 });
  }

  const sent = await sendPushToAllSubscriptions({
    title: 'PhysioNews — Test-Benachrichtigung',
    body: 'Wenn du das siehst, sind Push-Benachrichtigungen korrekt eingerichtet.',
    url: '/',
  });

  return Response.json({ ok: true, sentTo: sent });
}
