/**
 * App-Einstellungen — `data/settings.json`.
 *
 * Gelesen wird die Datei sowohl von der App (Settings-Seite, /api/settings)
 * als auch von der Pipeline in GitHub Actions (Refresh-Fenster, Retention,
 * Push an/aus). Geändert wird sie nur über die Settings-Seite.
 */

import type { AppSettings } from './types';
import { readJson, writeJson, toDate } from './json-store';

const FILE = 'settings.json';

/** Rohformat in der Datei — Zeitpunkte als ISO-String. */
interface StoredSettings {
  refreshIntervalHours: number;
  refreshWindowStart: number;
  refreshWindowEnd: number;
  retentionDays: number;
  notificationsEnabled: boolean;
  lastGlobalRefreshAt: string | null;
  lastNotifiedAt: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  refreshIntervalHours: 2,
  refreshWindowStart: 6,
  refreshWindowEnd: 22,
  retentionDays: 30,
  notificationsEnabled: true,
  lastGlobalRefreshAt: null,
  lastNotifiedAt: null,
};

function fromStored(stored: Partial<StoredSettings>): AppSettings {
  return {
    refreshIntervalHours: stored.refreshIntervalHours ?? DEFAULT_SETTINGS.refreshIntervalHours,
    refreshWindowStart: stored.refreshWindowStart ?? DEFAULT_SETTINGS.refreshWindowStart,
    refreshWindowEnd: stored.refreshWindowEnd ?? DEFAULT_SETTINGS.refreshWindowEnd,
    retentionDays: stored.retentionDays ?? DEFAULT_SETTINGS.retentionDays,
    notificationsEnabled:
      stored.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
    lastGlobalRefreshAt: toDate(stored.lastGlobalRefreshAt),
    lastNotifiedAt: toDate(stored.lastNotifiedAt),
  };
}

function toStored(settings: AppSettings): StoredSettings {
  return {
    refreshIntervalHours: settings.refreshIntervalHours,
    refreshWindowStart: settings.refreshWindowStart,
    refreshWindowEnd: settings.refreshWindowEnd,
    retentionDays: settings.retentionDays,
    notificationsEnabled: settings.notificationsEnabled,
    lastGlobalRefreshAt: settings.lastGlobalRefreshAt?.toISOString() ?? null,
    lastNotifiedAt: settings.lastNotifiedAt?.toISOString() ?? null,
  };
}

/** Liest die Einstellungen; fehlende Felder werden mit den Defaults gefüllt. */
export async function getSettings(): Promise<AppSettings> {
  const stored = await readJson<Partial<StoredSettings>>(FILE, {});
  return fromStored(stored);
}

/** Schreibt einzelne Felder und liefert den vollständigen neuen Stand. */
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const merged: AppSettings = { ...(await getSettings()), ...patch };
  await writeJson(FILE, toStored(merged), 'chore(data): Einstellungen aktualisiert');
  return merged;
}
