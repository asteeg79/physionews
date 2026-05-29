/**
 * Gemini Quota-Tracking — speichert Tagesverbrauch in der DB, damit wir
 * vor Erreichen des Free-Tier-Limits auf Keyword-only-Klassifizierung umschalten.
 *
 * Free-Tier-Limits für gemini-2.5-flash-lite (Stand 2026):
 *  - 1.000 RPM (Requests pro Minute)
 *  - 1.000.000 TPD (Tokens pro Tag)
 *  - 15.000 RPD (Requests pro Tag)
 *
 * Wir wählen einen konservativen Soft-Cap, damit auch Reclassify-Aktionen
 * oder unerwartete Spikes nicht den Tagesbetrieb blockieren.
 */

import { db, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';

/** Soft-Cap pro Tag — bei Überschreitung kein Gemini-Call mehr. */
const DAILY_TOKEN_SOFT_CAP = 800_000;
const DAILY_REQUEST_SOFT_CAP = 12_000;

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

/** Liefert den aktuellen Tagesverbrauch und die Restbudgets. */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const date = todayUtc();
  const [row] = await db
    .select()
    .from(schema.geminiUsage)
    .where(eq(schema.geminiUsage.date, date))
    .limit(1);

  const tokensUsed = row?.tokensUsed ?? 0;
  const requestsMade = row?.requestsMade ?? 0;
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

/**
 * Verbucht einen erfolgreichen Gemini-Call. Idempotent über UPSERT.
 */
export async function recordUsage(tokens: number, requests = 1): Promise<void> {
  const date = todayUtc();
  await db
    .insert(schema.geminiUsage)
    .values({
      date,
      tokensUsed: tokens,
      requestsMade: requests,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.geminiUsage.date,
      set: {
        tokensUsed: sql`${schema.geminiUsage.tokensUsed} + ${tokens}`,
        requestsMade: sql`${schema.geminiUsage.requestsMade} + ${requests}`,
        updatedAt: new Date(),
      },
    });
}

/** Setzt das heutige Budget künstlich auf 0 (nur für Tests). */
export async function resetTodayForTest(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') return;
  await db.delete(schema.geminiUsage).where(eq(schema.geminiUsage.date, todayUtc()));
}
