/**
 * Cron-Window-Check — geteiltes Helper für alle Cron-Endpoints.
 *
 * Liest app_settings.refreshWindowStart/End und vergleicht mit der
 * aktuellen Stunde in Europe/Berlin.
 */

import { db, schema } from '@/db';
import { getBerlinHour } from './timezone';

export interface WindowCheckResult {
  inWindow: boolean;
  berlinHour: number;
  settings: typeof schema.appSettings.$inferSelect;
}

/**
 * Lädt die App-Settings und prüft, ob die aktuelle Berliner Stunde im
 * konfigurierten Refresh-Fenster liegt.
 */
export async function checkWindow(): Promise<WindowCheckResult | null> {
  const [settings] = await db.select().from(schema.appSettings).limit(1);
  if (!settings) return null;

  const berlinHour = getBerlinHour();
  const inWindow =
    berlinHour >= settings.refreshWindowStart && berlinHour < settings.refreshWindowEnd;
  return { inWindow, berlinHour, settings };
}
