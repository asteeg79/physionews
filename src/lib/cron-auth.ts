/**
 * Cron-Auth — wiederverwendbarer Helper für die geheim-geschützten
 * Cron-Endpoints.
 *
 * Alle /api/cron/*-Routes nutzen denselben Secret-Header.
 */

/**
 * Prüft das X-Cron-Secret-Header gegen die Env-Variable.
 * Liefert eine Response (401) bei Mismatch, sonst null.
 */
export function checkCronSecret(req: Request): Response | null {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}
