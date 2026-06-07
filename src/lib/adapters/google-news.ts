import type { Source } from '@/db/schema';
import type { RawNewsItem, SourceAdapter } from './types';
import { RssAdapter } from './rss';

const rss = new RssAdapter();

/**
 * Google News als Quellen-Proxy.
 *
 * Hintergrund: Manche Seiten (z.B. physiotherapeuten.de mit Brightboy) blockieren
 * automatisierte Zugriffe und verbieten Scraping per robots.txt. Google darf jedoch
 * offiziell als News-Indexer crawlen — wir nutzen den öffentlichen Google-News-RSS,
 * der pro Suchanfrage einen Feed liefert.
 *
 * Format der Such-URL:
 *   https://news.google.com/rss/search?q={QUERY}&hl=de&gl=DE&ceid=DE:de
 *
 * Items kommen mit:
 *   - Titel "Original-Titel - Quellen-Name"
 *   - Link via news.google.com Redirect (führt im Browser zum Original)
 *   - pubDate
 *
 * Title-Cleanup: " - {Quellen-Name}" am Ende entfernen.
 */
/**
 * Maximales Alter, das ein Google-News-Treffer beim Einlesen haben darf.
 * Ältere Items werden verworfen — Google News liefert nach Themen-Suchen
 * gerne historische Artikel von 2017, 2019 etc., die niemals "neu" für
 * den User sind und die Liste mit Altlasten fluten.
 */
const MAX_AGE_DAYS = 60;

export class GoogleNewsAdapter implements SourceAdapter {
  readonly typeIdentifier = 'google-news';

  async fetch(source: Source): Promise<RawNewsItem[]> {
    // Source-URL ist die Google-News-Such-URL
    const items = await rss.fetch(source);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
    return items
      .filter((item) => {
        // Items ohne Datum verwerfen (lieber konservativ als Müll einlesen)
        if (!item.publishedAt) return false;
        return item.publishedAt.getTime() >= cutoff.getTime();
      })
      .map((item) => ({
        ...item,
        title: cleanGoogleNewsTitle(item.title),
        // Google News description ist nur eine Wiederholung des Titels mit
        // Quellen-Suffix "pt Zeitschrift für Physiotherapeuten" — wertlos und
        // produziert false positives in der Relevanz-Klassifizierung.
        // Wir setzen summary auf undefined, sodass /api/news/[id]/preview den
        // Original-Inhalt beim ersten Klick nachzieht.
        summary: undefined,
      }));
  }
}

/**
 * Entfernt das " - Quellen-Name"-Suffix, das Google News an jeden Titel anhängt.
 * Beispiel: "Knie-TEP: lange Haltbarkeit - pt Zeitschrift für Physiotherapeuten"
 *           → "Knie-TEP: lange Haltbarkeit"
 */
export function cleanGoogleNewsTitle(title: string): string {
  // Letzten " - ..."-Block entfernen, wenn er nicht der ganze Titel ist
  const idx = title.lastIndexOf(' - ');
  if (idx > 10 && idx < title.length - 3) {
    return title.slice(0, idx).trim();
  }
  return title.trim();
}

/**
 * Helfer für Seed/Settings: baut eine Google-News-RSS-URL aus Such-Query.
 */
export function buildGoogleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=de&gl=DE&ceid=DE:de`;
}
