/**
 * Gemini Quota-Tracking — speichert den Tagesverbrauch in
 * `data/gemini-usage.json`, damit wir vor Erreichen des Free-Tier-Limits
 * auf Keyword-only-Klassifizierung umschalten.
 *
 * Free-Tier-Limits für gemini-2.5-flash-lite (Stand 2026):
 *  - 1.000 RPM (Requests pro Minute)
 *  - 1.000.000 TPD (Tokens pro Tag)
 *  - 15.000 RPD (Requests pro Tag)
 *
 * Wir wählen einen konservativen Soft-Cap, damit auch Reclassify-Aktionen
 * oder unerwartete Spikes nicht den Tagesbetrieb blockieren.
 *
 * Geschrieben wird die Datei nur von der Pipeline in GitHub Actions; die
 * App liest sie für die Verbrauchsanzeige in den Einstellungen.
 */

import type { GeminiUsageDay } from '@/data/types';
import { readJson, writeJson, toRequiredDate } from '@/data/json-store';

const FILE = 'gemini-usage.json';

/** Soft-Cap pro Tag — bei Überschreitung kein Gemini-Call mehr. */
const DAILY_TOKEN_SOFT_CAP = 800_000;
const DAILY_REQUEST_SOFT_CAP = 12_000;

/** So viele Tage Historie bleiben in der Datei stehen. */
const KEEP_DAYS = 30;

interface StoredUsageDay {
  date: string;
  tokensUsed: number;
  requestsMade: number;
  updatedAt: string;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface QuotaStatus {
  date: string;
  tokensUsed: number;
  requestsMade: number;
  tokensRemaining: number;
  requestsRemaining: number;
  canUseAi: boolean;
}

/** Der komplette Verlauf, neueste Tage zuerst. */
export async function listUsage(): Promise<GeminiUsageDay[]> {
  const stored = await readJson<StoredUsageDay[]>(FILE, []);
  return stored
    .map((d) => ({ ...d, updatedAt: toRequiredDate(d.updatedAt) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Liefert den aktuellen Tagesverbrauch und die Restbudgets. */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const date = todayUtc();
  const today = (await listUsage()).find((d) => d.date === date);

  const tokensUsed = today?.tokensUsed ?? 0;
  const requestsMade = today?.requestsMade ?? 0;
  const tokensRemaining = Math.max(0, DAILY_TOKEN_SOFT_CAP - tokensUsed);
  const requestsRemaining = Math.max(0, DAILY_REQUEST_SOFT_CAP - requestsMade);

  return {
    date,
    tokensUsed,
    requestsMade,
    tokensRemaining,
    requestsRemaining,
    canUseAi: tokensRemaining > 5_000 && requestsRemaining > 0,
  };
}

/** Verbucht einen erfolgreichen Gemini-Call auf dem heutigen Tag. */
export async function recordUsage(tokens: number, requests = 1): Promise<void> {
  const date = todayUtc();
  const stored = await readJson<StoredUsageDay[]>(FILE, []);
  const index = stored.findIndex((d) => d.date === date);

  const updated: StoredUsageDay =
    index === -1
      ? { date, tokensUsed: tokens, requestsMade: requests, updatedAt: new Date().toISOString() }
      : {
          date,
          tokensUsed: stored[index].tokensUsed + tokens,
          requestsMade: stored[index].requestsMade + requests,
          updatedAt: new Date().toISOString(),
        };

  const next = [...stored];
  if (index === -1) next.push(updated);
  else next[index] = updated;

  // Alte Tage abschneiden — die Datei soll nicht unbegrenzt wachsen.
  const trimmed = next.toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP_DAYS);

  await writeJson(FILE, trimmed, 'chore(data): Gemini-Verbrauch aktualisiert');
}
