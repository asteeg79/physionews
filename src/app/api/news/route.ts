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

  const conditions = [sourceCategoryFilter, sinceFilter].filter(Boolean) as ReturnType<typeof eq>[];

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
    .orderBy(desc(schema.newsItems.publishedAt))
    .limit(limit);

  return Response.json(items, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
  });
}
