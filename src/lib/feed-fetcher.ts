/**
 * Feed-Fetcher — orchestriert das Abrufen aller aktiven News-Quellen.
 *
 * Aufgaben:
 *  1. Aktive Quellen aus `data/sources.json` lesen
 *  2. Pro Quelle den passenden Adapter ermitteln und fetchen (max 4 parallel)
 *  3. Items über ihren SHA-Hash deduplizieren und neue anhängen
 *  4. Bei Fehler: bis zu 1 Retry bei retryable Fehlern (Timeout, 5xx, ECONNRESET)
 *  5. Abruf-Status je Quelle festhalten (lastFetchAt / lastSuccessAt / lastError)
 *  6. Beide Dateien einmal am Ende schreiben
 *
 * Läuft in GitHub Actions (siehe scripts/pipeline/fetch.ts). Die
 * Klassifizierung ist bewusst nicht Teil dieser Stufe.
 */
import pLimit from 'p-limit';
import type { NewsItem, Source } from '@/data/types';
import { listSources, saveSources } from '@/data/sources';
import { loadNews, saveNews } from '@/data/news';
import { computeItemId } from './dedup';
import { getAdapter } from './adapters/registry';
import { detectLanguage } from './lang-detect';
import type { RawNewsItem } from './adapters/types';

/** Maximum gleichzeitige Adapter-Aufrufe — schützt vor Rate-Limits der Quellen. */
const MAX_CONCURRENT = 4;

/** Ergebnis pro einzelner Source. */
export interface FetchResult {
  sourceId: string;
  sourceName: string;
  /** Anzahl Items, die wirklich neu hinzugekommen sind (Dedup-Treffer zählen nicht). */
  newItems: number;
  /** Fehlermeldung, falls der Abruf auch nach dem Retry fehlgeschlagen ist. */
  error?: string;
}

/**
 * Fetcht alle aktivierten Quellen parallel (limit 4) und hängt neue Items
 * an `data/news.json` an.
 *
 * @returns Pro-Quelle-Ergebnisse plus Gesamt-Summe neuer Items.
 */
export async function fetchAllSources(): Promise<{ results: FetchResult[]; totalNew: number }> {
  const sources = await listSources();
  const news = await loadNews();
  const knownIds = new Set(news.map((n) => n.id));

  const limit = pLimit(MAX_CONCURRENT);
  const results = await Promise.all(
    sources
      .filter((s) => s.isEnabled)
      .map((source) => limit(() => fetchSource(source, news, knownIds)))
  );

  // Beide Dateien einmal schreiben — die Stufen darunter arbeiten auf
  // dem Array im Speicher.
  await saveNews(news, 'chore(data): neue News abgerufen');
  await saveSources(sources, 'chore(data): Abruf-Status aktualisiert');

  const totalNew = results.reduce((sum, r) => sum + r.newItems, 0);
  return { results, totalNew };
}

/**
 * Holt eine einzelne Quelle mit Retry-Logik und schreibt ihren Abruf-Status
 * direkt in das übergebene `Source`-Objekt (das Teil der Liste ist, die der
 * Aufrufer am Ende speichert).
 */
async function fetchSource(
  source: Source,
  news: NewsItem[],
  knownIds: Set<string>
): Promise<FetchResult> {
  const now = new Date();
  source.lastFetchAt = now;

  const adapter = getAdapter(source.adapterType);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawItems = await adapter.fetch(source);
      const newItems = appendItems(rawItems, source.id, news, knownIds);

      source.lastSuccessAt = now;
      source.lastError = null;

      return { sourceId: source.id, sourceName: source.name, newItems };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      console.warn(
        `[FeedFetcher] Versuch ${attempt} bei "${source.name}" fehlgeschlagen, retry in 2s...`
      );
      await sleep(2000);
    }
  }

  const message = formatError(lastError, source.url);
  console.error(`[FeedFetcher] Fehler bei "${source.name}":`, message);
  source.lastError = message.slice(0, 500);

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
    if (msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('econnrefused'))
      return true;
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
 * Hängt neue Items an die Liste an. Dedup-Schlüssel ist
 * `sha256(sourceId + '|' + normalize(url) + '|' + normalize(title))`,
 * siehe lib/dedup.ts — bereits bekannte IDs werden übersprungen.
 *
 * @returns Anzahl tatsächlich hinzugefügter Items.
 */
function appendItems(
  rawItems: RawNewsItem[],
  sourceId: string,
  news: NewsItem[],
  knownIds: Set<string>
): number {
  if (rawItems.length === 0) return 0;

  const fetchedAt = new Date();
  let added = 0;

  for (const item of rawItems) {
    const id = computeItemId(sourceId, item.url, item.title);
    if (knownIds.has(id)) continue;
    knownIds.add(id);

    // Sprache aus Titel + Summary erkennen. Items, die nicht deutsch sind,
    // werden zwar aufgenommen, aber im Frontend ausgeblendet und beim
    // nächsten Maintenance-Lauf gelöscht.
    const detected = detectLanguage(`${item.title} ${item.summary ?? ''}`);

    news.push({
      id,
      sourceId,
      title: item.title,
      summary: item.summary ?? null,
      url: item.url,
      imageUrl: item.imageUrl ?? null,
      publishedAt: item.publishedAt,
      fetchedAt,
      notifiedAt: null,
      relevanceScore: 5,
      relevanceMethod: 'pending',
      relevanceReason: null,
      isTopNews: false,
      topics: [],
      lang: detected === 'unknown' ? 'de' : detected,
    });
    added++;
  }

  return added;
}
