import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { extractArticleSummary } from '@/lib/content-extractor';

/**
 * GET /api/news/[id]/preview — liefert einen Vorschautext.
 *
 * Wird vom Frontend beim Aufklappen einer Karte aufgerufen.
 * Erfolg-Path:
 *  1. Wenn bereits ein guter summary (≥ 200 Zeichen) in der DB → direkt zurückgeben
 *  2. Sonst: URL fetchen, Hauptinhalt extrahieren, cachen, zurückgeben
 *
 * Bei Fehler liefert die Antwort { summary: null } — das Frontend zeigt dann
 * einen freundlichen "beim Anbieter weiterlesen"-Hinweis.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [item] = await db
    .select({ id: schema.newsItems.id, url: schema.newsItems.url, summary: schema.newsItems.summary })
    .from(schema.newsItems)
    .where(eq(schema.newsItems.id, id))
    .limit(1);

  if (!item) {
    return Response.json({ error: 'Item nicht gefunden' }, { status: 404 });
  }

  // 1. Cache-Hit: brauchbares Summary bereits vorhanden
  if (item.summary && item.summary.length >= 200) {
    return Response.json({ summary: item.summary, cached: true });
  }

  // 2. Live-Fetch der Originalseite
  const fetched = await extractArticleSummary(item.url);
  if (fetched) {
    // In DB speichern, damit der nächste Klick instant ist
    await db
      .update(schema.newsItems)
      .set({ summary: fetched })
      .where(eq(schema.newsItems.id, id))
      .catch(() => undefined);
    return Response.json({ summary: fetched, cached: false });
  }

  return Response.json({ summary: null, reason: 'unavailable' });
}
