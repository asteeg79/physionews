import pLimit from 'p-limit';
import { eq, inArray, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { computeItemId } from './dedup';
import { getAdapter } from './adapters/registry';
import type { Source, NewNewsItem } from '@/db/schema';
import type { RawNewsItem } from './adapters/types';

const MAX_CONCURRENT = 4;

export interface FetchResult {
  sourceId: string;
  sourceName: string;
  newItems: number;
  error?: string;
}

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
  return { results, totalNew };
}

async function fetchSource(source: Source): Promise<FetchResult> {
  const now = new Date();

  try {
    await db
      .update(schema.sources)
      .set({ lastFetchAt: now })
      .where(eq(schema.sources.id, source.id));

    const adapter = getAdapter(source.adapterType);
    const rawItems = await adapter.fetch(source);

    const newItems = await insertItems(rawItems, source.id);

    await db
      .update(schema.sources)
      .set({ lastSuccessAt: now, lastError: null })
      .where(eq(schema.sources.id, source.id));

    return { sourceId: source.id, sourceName: source.name, newItems };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[FeedFetcher] Fehler bei "${source.name}":`, message);

    await db
      .update(schema.sources)
      .set({ lastError: message })
      .where(eq(schema.sources.id, source.id));

    return { sourceId: source.id, sourceName: source.name, newItems: 0, error: message };
  }
}

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

export async function getTopTitles(sourceIds: string[], maxItems = 3): Promise<string> {
  const recentItems = await db
    .select({ title: schema.newsItems.title })
    .from(schema.newsItems)
    .where(inArray(schema.newsItems.sourceId, sourceIds))
    .orderBy(desc(schema.newsItems.fetchedAt))
    .limit(maxItems);

  return recentItems.map((i) => `• ${i.title}`).join('\n');
}
