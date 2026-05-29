/**
 * GET /api/news — Liste der News-Items für das Frontend.
 *
 * Filter (alle optional, kombinierbar):
 *  - category=<NewsCategory>: nur Items aus Quellen dieser Kategorie
 *  - since=<ISO-Date>: nur Items ab diesem Datum
 *  - topNews=true: nur AI-kuratierte Top-News (is_top_news=true)
 *  - q=<text>: Volltext-Suche über Titel + Summary (Postgres tsvector)
 *  - tag=<string>: nur Items mit diesem Topic-Tag
 *  - limit=<int>: maximale Items (Default 100, max 200)
 *
 * Sortierung: Relevanz DESC, dann Datum DESC.
 *
 * Items mit Score &lt; 4 werden bereits beim Klassifizieren gelöscht, hier
 * also nur ein doppelter Boden im WHERE.
 */
import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { desc, eq, and, gte, inArray, sql } from 'drizzle-orm';
import type { NewsCategory } from '@/db/schema';
import { EVIDENCE_TOPICS } from '@/lib/relevance/topics';

export const revalidate = 60;

const MIN_RELEVANCE = 4;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get('category') as NewsCategory | null;
  const since = sp.get('since');
  const limit = Math.min(parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT);
  const topNewsOnly = sp.get('topNews') === 'true';
  const searchQuery = sp.get('q')?.trim() || null;
  const tag = sp.get('tag')?.trim() || null;
  const evidenceOnly = sp.get('ebp') === 'true';

  // Kategorie-Filter via Source-IDs
  let sourceCategoryFilter: ReturnType<typeof eq> | undefined;
  if (category) {
    const sourceIds = await db
      .select({ id: schema.sources.id })
      .from(schema.sources)
      .where(eq(schema.sources.category, category));

    if (sourceIds.length === 0) {
      return jsonResponse([]);
    }
    sourceCategoryFilter = inArray(
      schema.newsItems.sourceId,
      sourceIds.map((s) => s.id)
    ) as ReturnType<typeof eq>;
  }

  const sinceFilter = since
    ? (gte(schema.newsItems.publishedAt, new Date(since)) as ReturnType<typeof eq>)
    : undefined;
  const relevanceFilter = gte(
    schema.newsItems.relevanceScore,
    MIN_RELEVANCE
  ) as ReturnType<typeof eq>;

  // Sprach-Filter: nur deutsche Items zeigen.
  // 'unknown' wird beim Insert auf 'de' gemapped, daher nur 'de' OK.
  const langFilter = eq(schema.newsItems.lang, 'de') as ReturnType<typeof eq>;
  const topNewsFilter = topNewsOnly
    ? (eq(schema.newsItems.isTopNews, true) as ReturnType<typeof eq>)
    : undefined;

  // Volltext-Suche: nutzt search_vector GIN-Index, websearch_to_tsquery
  // erlaubt Phrasen, AND, OR und Anführungszeichen.
  const searchFilter = searchQuery
    ? (sql`${schema.newsItems.id} IN (
        SELECT id FROM news_items
        WHERE search_vector @@ websearch_to_tsquery('german', ${searchQuery})
      )` as ReturnType<typeof eq>)
    : undefined;

  // Tag-Filter: nutzt GIN-Index auf topics-Array
  const tagFilter = tag
    ? (sql`${tag} = ANY(${schema.newsItems.topics})` as ReturnType<typeof eq>)
    : undefined;

  // EBP-Filter: mindestens ein Evidenz-Tag muss vorkommen.
  // Postgres-Operator && (overlap) testet, ob zwei Arrays mindestens ein
  // gemeinsames Element haben — nutzt den GIN-Index auf topics.
  const ebpFilter = evidenceOnly
    ? (sql`${schema.newsItems.topics} && ${sql`ARRAY[${sql.join(
        EVIDENCE_TOPICS.map((t) => sql`${t}`),
        sql`, `
      )}]::text[]`}` as ReturnType<typeof eq>)
    : undefined;

  const conditions = [
    sourceCategoryFilter,
    sinceFilter,
    relevanceFilter,
    langFilter,
    topNewsFilter,
    searchFilter,
    tagFilter,
    ebpFilter,
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
      topics: schema.newsItems.topics,
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
    .orderBy(desc(schema.newsItems.relevanceScore), desc(schema.newsItems.publishedAt))
    .limit(limit);

  return jsonResponse(items);
}

function jsonResponse<T>(body: T): Response {
  return Response.json(body, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
  });
}
