import { getNewsItem } from '@/data/news';
import { extractArticleSummary } from '@/lib/content-extractor';

/**
 * GET /api/news/[id]/preview — liefert einen Vorschautext.
 *
 * Wird vom Frontend beim Öffnen einer Karte aufgerufen:
 *  1. Steht in `data/news.json` schon ein brauchbarer Text (≥ 200 Zeichen),
 *     kommt der direkt zurück
 *  2. Sonst wird die Originalseite geholt und der Hauptinhalt extrahiert
 *
 * Anders als früher wird das Ergebnis NICHT zurückgeschrieben: die App läuft
 * auf einem read-only Dateisystem, und ein Commit pro Kartenöffnung wäre
 * unverhältnismäßig. Der Edge-Cache-Header unten fängt Wiederholungen ab.
 *
 * Bei Fehler liefert die Antwort `{ summary: null }` — das Frontend zeigt
 * dann einen freundlichen „beim Anbieter weiterlesen"-Hinweis.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const item = await getNewsItem(id);
  if (!item) {
    return Response.json({ error: 'Item nicht gefunden' }, { status: 404 });
  }

  if (item.summary && item.summary.length >= 200) {
    return Response.json({ summary: item.summary, cached: true });
  }

  const fetched = await extractArticleSummary(item.url);
  if (fetched) {
    return Response.json(
      { summary: fetched, cached: false },
      {
        headers: {
          // Ersetzt das frühere Zurückschreiben in die Datenbank: derselbe
          // Artikel wird innerhalb eines Tages nur einmal wirklich geholt.
          'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  }

  return Response.json({ summary: null, reason: 'unavailable' });
}
