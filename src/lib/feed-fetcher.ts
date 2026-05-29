/**
 * Feed-Fetcher — orchestriert das Abrufen aller aktiven News-Quellen.
 *
 * Aufgaben:
 *  1. Aktive Sources aus der DB lesen
 *  2. Pro Source den passenden Adapter ermitteln und fetchen (max 4 parallel)
 *  3. Items deduplizieren via SHA-Hash und mit ON CONFLICT DO NOTHING inserten
 *  4. Bei Fehler: bis zu 1 Retry bei retryable Fehlern (Timeout, 5xx, ECONNRESET)
 *  5. Source-Status updaten (lastFetchAt / lastSuccessAt / lastError)
 *  6. Nach allen Fetches: Relevanz-Klassifizierung der neuen Items anstoßen
 *
 * Wird vom Cron-Endpoint und /api/refresh-on-demand verwendet.
 */
import pLimit from 'p-limit';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { computeItemId } from './dedup';
import { getAdapter } from './adapters/registry';
import type { Source, NewNewsItem } from '@/db/schema';
import type { RawNewsItem } from './adapters/types';

/** Maximum gleichzeitige Adapter-Aufrufe — schützt vor Rate-Limits der Quellen. */
const MAX_CONCURRENT = 4;

/** Ergebnis pro einzelner Source. */
export interface FetchResult {
  sourceId: string;
  sourceName: string;
  /** Anzahl Items, die wirklich neu eingefügt wurden (Dedup-Hits zählen nicht). */
  newItems: number;
  /** Fehlermeldung, falls Fetch nach Retry fehlgeschlagen ist. */
  error?: string;
}

/**
 * Fetcht alle aktivierten Quellen parallel (limit 4), inserted neue Items
 * und triggert anschließend die Relevanz-Klassifizierung.
 *
 * @returns Pro-Source-Ergebnisse plus Gesamt-Summe neuer Items.
 */
export async function fetchAllSources(): Promise<{ results: FetchResult[]; totalNew: number }> {
  const activeSources = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.isEnabled, true));

  const limit = pLimit(MAX_CONCURRENT);

  const results = await Promise.all(
    activeSources.map((source) => limit(() => fetchSource(source)))
  );

  const totalNew = results.reduce((sum, r) => sum + r.newItems, 0);
  // Klassifizierung läuft nicht mehr hier — wird vom /api/cron/classify-Endpoint
  // separat angestoßen. So bleibt jeder Cron-Endpoint im Vercel-Function-Timeout.
  return { results, totalNew };
}

/**
 * Holt eine einzelne Source mit Retry-Logik. Updated source.lastFetchAt /
 * lastSuccessAt / lastError in der DB.
 */
async function fetchSource(source: Source): Promise<FetchResult> {
  const now = new Date();

  await db
    .update(schema.sources)
    .set({ lastFetchAt: now })
    .where(eq(schema.sources.id, source.id));

  const adapter = getAdapter(source.adapterType);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawItems = await adapter.fetch(source);
      const newItems = await insertItems(rawItems, source.id);

      await db
        .update(schema.sources)
        .set({ lastSuccessAt: now, lastError: null })
        .where(eq(schema.sources.id, source.id));

      return { sourceId: source.id, sourceName: source.name, newItems };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      console.warn(`[FeedFetcher] Versuch ${attempt} bei "${source.name}" fehlgeschlagen, retry in 2s...`);
      await sleep(2000);
    }
  }

  const message = formatError(lastError, source.url);
  console.error(`[FeedFetcher] Fehler bei "${source.name}":`, message);

  await db
    .update(schema.sources)
    .set({ lastError: message.slice(0, 500) })
    .where(eq(schema.sources.id, source.id));

  return { sourceId: source.id, sourceName: source.name, newItems: 0, error: message };
}

/**
 * Heuristik: ist der Fehler "vorübergehend" (Timeout, 5xx, Netzwerk)?
 * Permanent Errors (404, 401, ungültige URL) werden NICHT retried.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('http 5')) return true; // 5xx
    if (msg.includes('timeout') || msg.includes('aborted')) return true;
    if (msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('econnrefused')) return true;
  }
  return false;
}

function formatError(err: unknown, sourceUrl: string): string {
  if (err instanceof Error) {
    return `${err.message} (${sourceUrl})`;
  }
  return `${String(err)} (${sourceUrl})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Inserted Items mit ON CONFLICT DO NOTHING. Dedup-Schlüssel ist
 * `sha256(sourceId + '|' + normalize(url) + '|' + normalize(title))`,
 * siehe lib/dedup.ts.
 *
 * @returns Anzahl tatsächlich eingefügter Zeilen.
 */
async function insertItems(rawItems: RawNewsItem[], sourceId: string): Promise<number> {
  if (rawItems.length === 0) return 0;

  const toInsert: NewNewsItem[] = rawItems.map((item) => ({
    id: computeItemId(sourceId, item.url, item.title),
    sourceId,
    title: item.title,
    summary: item.summary,
    url: item.url,
    imageUrl: item.imageUrl,
    publishedAt: item.publishedAt,
  }));

  const inserted = await db
    .insert(schema.newsItems)
    .values(toInsert)
    .onConflictDoNothing()
    .returning({ id: schema.newsItems.id });

  return inserted.length;
}

// getTopTitles war für die alte gebündelte Push-Notification — entfernt,
// seit Cron pro hochrelevantem Item eine eigene Push schickt.
