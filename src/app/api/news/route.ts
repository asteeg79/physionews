/**
 * GET /api/news — Liste der News-Items für das Frontend.
 *
 * Filter (alle optional, kombinierbar):
 *  - category=<NewsCategory>: nur Items aus Quellen dieser Kategorie
 *  - since=<ISO-Date>: nur Items ab diesem Datum
 *  - topNews=true: nur KI-kuratierte Top-News
 *  - q=<text>: Suche über Titel + Zusammenfassung
 *  - tag=<string>: nur Items mit diesem Themen-Tag
 *  - ebp=true: nur Items mit mindestens einem Evidenz-Tag
 *  - limit=<int>: maximale Items (Default 100, max 200)
 *
 * Sortierung: Relevanz DESC, dann Datum DESC.
 *
 * Gelesen wird `data/news.json` aus dem Deployment — die Datei wird von
 * der Pipeline in GitHub Actions gepflegt (siehe scripts/pipeline/).
 * Ob ein Item gelesen wurde, steht nicht mehr in den Daten, sondern pro
 * Gerät im localStorage (siehe lib/read-state.ts).
 */
import { NextRequest } from 'next/server';
import { MAX_ITEMS_PER_SOURCE, queryNews } from '@/data/news';
import type { NewsCategory } from '@/data/types';
import { EVIDENCE_TOPICS } from '@/lib/relevance/topics';

export const revalidate = 60;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const since = sp.get('since');
  const parsedLimit = Number.parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10);

  const search = sp.get('q')?.trim() || undefined;
  const tag = sp.get('tag')?.trim() || undefined;

  const items = await queryNews({
    category: (sp.get('category') as NewsCategory | null) ?? undefined,
    since: since ? new Date(since) : undefined,
    topNewsOnly: sp.get('topNews') === 'true',
    search,
    tag,
    // Bei gezielter Suche oder Tag-Filter kein Deckel — dort sollen alle
    // Treffer erscheinen, auch wenn sie aus derselben Quelle stammen.
    maxPerSource: search || tag ? undefined : MAX_ITEMS_PER_SOURCE,
    evidenceTopics: sp.get('ebp') === 'true' ? EVIDENCE_TOPICS : undefined,
    limit: Math.min(Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit, MAX_LIMIT),
  });

  return jsonResponse(items);
}

/**
 * Setzt Cache-Header für die News-API.
 *
 * Zwei separate Layer:
 *  - `Cache-Control` → Browser-Cache (max-age) für rapid Filter-Wechsel
 *  - `CDN-Cache-Control` → Vercel-Edge-Cache (überlebt Deploys nicht,
 *    aber gut für concurrent Requests vom selben Edge-PoP)
 *
 * Vercel überschreibt `Cache-Control` allein auf dynamic Routes mit
 * `max-age=0` — `CDN-Cache-Control` wird respektiert und nicht überschrieben.
 *
 * Werte:
 *  - Browser: max-age=20 (Filter-Wechsel innerhalb von 20s = instant)
 *  - Edge:    s-maxage=60 + SWR=300 (Bursts nach einem Deploy abfangen)
 */
function jsonResponse<T>(body: T): Response {
  return Response.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=20, stale-while-revalidate=60',
      'CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
