/**
 * Refresh-Fenster-Check — geteiltes Helper für die Pipeline-Stufen.
 *
 * Liest `refreshWindowStart`/`refreshWindowEnd` aus `data/settings.json`
 * und vergleicht sie mit der aktuellen Stunde in Europe/Berlin.
 */

import type { AppSettings } from '@/data/types';
import { getSettings } from '@/data/settings';
import { getBerlinHour } from './timezone';

export interface WindowCheckResult {
  inWindow: boolean;
  berlinHour: number;
  settings: AppSettings;
}

/**
 * Lädt die App-Einstellungen und prüft, ob die aktuelle Berliner Stunde im
 * konfigurierten Refresh-Fenster liegt.
 */
export async function checkWindow(): Promise<WindowCheckResult> {
  const settings = await getSettings();
  const berlinHour = getBerlinHour();
  const inWindow =
    berlinHour >= settings.refreshWindowStart && berlinHour < settings.refreshWindowEnd;
  return { inWindow, berlinHour, settings };
}
