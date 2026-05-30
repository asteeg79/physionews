/**
 * Gemini Result-Cache — pro Title-Hash speichern, damit identische Titel
 * (z.B. wenn dieselbe Pressemitteilung über zwei Quellen läuft) nicht
 * mehrfach klassifiziert werden müssen.
 *
 * Lifetime: implizit — Einträge mit createdAt > 30 Tage werden vom
 * Maintenance-Cron mit gelöscht (siehe Maintenance-Endpoint).
 */

import { createHash } from 'crypto';
import { db, schema } from '@/db';
import { eq, inArray, lt } from 'drizzle-orm';

export interface CachedClassification {
  score: number;
  topics: string[];
  reason: string;
}

/**
 * Normalisiert einen Titel und liefert einen 16-Hex-Hash.
 * Normalisierung: lowercase, mehrfache Spaces, kein Trailing-Whitespace.
 */
export function titleHash(title: string): string {
  const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/** Liefert für eine Menge von Titel-Hashes alle Cache-Treffer. */
export async function getCachedByHashes(
  hashes: string[]
): Promise<Map<string, CachedClassification>> {
  const result = new Map<string, CachedClassification>();
  if (hashes.length === 0) return result;
  const rows = await db
    .select()
    .from(schema.geminiCache)
    .where(inArray(schema.geminiCache.titleHash, hashes));
  for (const r of rows) {
    result.set(r.titleHash, {
      score: r.score,
      topics: r.topics,
      reason: r.reason,
    });
  }
  return result;
}

/**
 * Persistiert mehrere Klassifizierungen in den Cache.
 *
 * Strategie: ON CONFLICT DO NOTHING — wenn der Titel-Hash schon im Cache
 * liegt, ist der Inhalt per Definition identisch (Hash ist deterministisch
 * über den normalisierten Titel) und der vorhandene Eintrag bleibt gültig.
 *
 * Der frühere `onConflictDoUpdate` mit `set: { …: schema.col }` hat in
 * Drizzle keinen EXCLUDED-Verweis erzeugt und in seltenen Race-Conditions
 * Constraint-Fehler ausgelöst (zwei parallele Batches mit derselben Title-
 * Variante kollidierten). DO NOTHING ist semantisch korrekter und stabil.
 */
export async function setCachedBulk(
  entries: Array<{ titleHash: string } & CachedClassification>
): Promise<void> {
  if (entries.length === 0) return;
  await db
    .insert(schema.geminiCache)
    .values(
      entries.map((e) => ({
        titleHash: e.titleHash,
        score: e.score,
        topics: e.topics,
        reason: e.reason,
      }))
    )
    .onConflictDoNothing({ target: schema.geminiCache.titleHash });
}

/** Cleanup: löscht Cache-Einträge älter als N Tage. */
export async function pruneCache(olderThanDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const deleted = await db
    .delete(schema.geminiCache)
    .where(lt(schema.geminiCache.createdAt, cutoff))
    .returning({ titleHash: schema.geminiCache.titleHash });
  return deleted.length;
}
