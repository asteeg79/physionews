/**
 * Gemini Result-Cache — `data/gemini-cache.json`.
 *
 * Pro Title-Hash wird das Klassifizierungs-Ergebnis gespeichert, damit
 * identische Titel (z. B. wenn dieselbe Pressemitteilung über zwei Quellen
 * läuft) nicht mehrfach klassifiziert werden müssen.
 *
 * Lifetime: Einträge älter als 30 Tage räumt die Maintenance-Stufe der
 * Pipeline über `pruneCache` weg.
 */

import { createHash } from 'node:crypto';
import type { GeminiCacheEntry } from '@/data/types';
import { readJson, writeJson, toRequiredDate } from '@/data/json-store';

const FILE = 'gemini-cache.json';

interface StoredCacheEntry {
  titleHash: string;
  score: number;
  topics: string[];
  reason: string;
  createdAt: string;
}

export interface CachedClassification {
  score: number;
  topics: string[];
  reason: string;
}

/**
 * Normalisiert einen Titel und liefert einen 32-Hex-Hash.
 * Normalisierung: lowercase, mehrfache Spaces, kein Trailing-Whitespace.
 */
export function titleHash(title: string): string {
  const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

async function loadEntries(): Promise<StoredCacheEntry[]> {
  return readJson<StoredCacheEntry[]>(FILE, []);
}

/** Alle Cache-Einträge — für Skripte und Diagnose. */
export async function listCacheEntries(): Promise<GeminiCacheEntry[]> {
  return (await loadEntries()).map((e) => ({
    ...e,
    createdAt: toRequiredDate(e.createdAt),
  }));
}

/** Liefert für eine Menge von Titel-Hashes alle Cache-Treffer. */
export async function getCachedByHashes(
  hashes: string[]
): Promise<Map<string, CachedClassification>> {
  const result = new Map<string, CachedClassification>();
  if (hashes.length === 0) return result;

  const wanted = new Set(hashes);
  for (const entry of await loadEntries()) {
    if (!wanted.has(entry.titleHash)) continue;
    result.set(entry.titleHash, {
      score: entry.score,
      topics: entry.topics,
      reason: entry.reason,
    });
  }
  return result;
}

/**
 * Persistiert mehrere Klassifizierungen.
 *
 * Bereits vorhandene Hashes bleiben unverändert: der Hash ist deterministisch
 * über den normalisierten Titel, ein vorhandener Eintrag ist also per
 * Definition schon der richtige.
 */
export async function setCachedBulk(
  entries: Array<{ titleHash: string } & CachedClassification>
): Promise<void> {
  if (entries.length === 0) return;

  const stored = await loadEntries();
  const known = new Set(stored.map((e) => e.titleHash));
  const now = new Date().toISOString();

  let added = 0;
  for (const entry of entries) {
    if (known.has(entry.titleHash)) continue;
    known.add(entry.titleHash);
    stored.push({
      titleHash: entry.titleHash,
      score: entry.score,
      topics: entry.topics,
      reason: entry.reason,
      createdAt: now,
    });
    added++;
  }

  if (added === 0) return;
  await writeJson(FILE, stored, 'chore(data): Gemini-Cache ergänzt');
}

/** Cleanup: löscht Cache-Einträge älter als N Tage. */
export async function pruneCache(olderThanDays: number): Promise<number> {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const stored = await loadEntries();
  const remaining = stored.filter((e) => new Date(e.createdAt).getTime() > cutoff);

  const removed = stored.length - remaining.length;
  if (removed > 0) {
    await writeJson(FILE, remaining, 'chore(data): Gemini-Cache aufgeräumt');
  }
  return removed;
}
