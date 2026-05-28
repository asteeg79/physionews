import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { desc, eq, and, gte, inArray } from 'drizzle-orm';
import type { NewsCategory } from '@/db/schema';

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get('category') as NewsCategory | null;
  const since = searchParams.get('since');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200);
  // Items mit Score &lt; 4 werden bereits beim Klassifizieren gelöscht.
  // Doppelter Boden hier, falls trotzdem etwas durchgeschlüpft ist.
  const minRelevance = 4;
  /** Wenn true, werden nur die AI-kuratierten Top-News zurückgegeben (is_top_news=true). */
  const topNewsOnly = searchParams.get('topNews') === 'true';

  // Quellen-IDs für die Kategorie ermitteln
  let sourceCategoryFilter: ReturnType<typeof eq> | undefined;
  if (category) {
    const sourceIds = await db
      .select({ id: schema.sources.id })
      .from(schema.sources)
      .where(eq(schema.sources.category, category));

    if (sourceIds.length === 0) {
      return Response.json([], {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
      });
    }
    sourceCategoryFilter = inArray(
      schema.newsItems.sourceId,
      sourceIds.map((s) => s.id)
    ) as ReturnType<typeof eq>;
  }

  const sinceFilter = since
    ? (gte(schema.newsItems.publishedAt, new Date(since)) as ReturnType<typeof eq>)
    : undefined;

  const relevanceFilter =
    minRelevance > 0
      ? (gte(schema.newsItems.relevanceScore, minRelevance) as ReturnType<typeof eq>)
      : undefined;

  const topNewsFilter = topNewsOnly
    ? (eq(schema.newsItems.isTopNews, true) as ReturnType<typeof eq>)
    : undefined;

  const conditions = [
    sourceCategoryFilter,
    sinceFilter,
    relevanceFilter,
    topNewsFilter,
  ].filter(Boolean) as ReturnType<typeof eq>[];

  const items = await db
    .select({
      id: schema.newsItems.id,
      sourceId: schema.newsItems.sourceId,
      title: schema.newsItems.title,
      summary: schema.newsItems.summary,
      url: schema.newsItems.url,
      imageUrl: schema.newsItems.imageUrl,
      publishedAt: schema.newsItems.publishedAt,
      fetchedAt: schema.newsItems.fetchedAt,
      isRead: schema.newsItems.isRead,
      relevanceScore: schema.newsItems.relevanceScore,
      relevanceMethod: schema.newsItems.relevanceMethod,
      source: {
        id: schema.sources.id,
        name: schema.sources.name,
        category: schema.sources.category,
        iconName: schema.sources.iconName,
      },
    })
    .from(schema.newsItems)
    .innerJoin(schema.sources, eq(schema.newsItems.sourceId, schema.sources.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    // Sortierung: zuerst Relevanz (hoch zuerst), dann Datum (neu zuerst)
    .orderBy(desc(schema.newsItems.relevanceScore), desc(schema.newsItems.publishedAt))
    .limit(limit);

  return Response.json(items, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
  });
}
