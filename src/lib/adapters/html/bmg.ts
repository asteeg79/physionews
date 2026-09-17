import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.bundesgesundheitsministerium.de/presse/pressemitteilungen
// Struktur: <h3 class="u-typo:l u-typo:bold"><a href="/presse/pressemitteilungen/{slug}-pm-{DD-MM-YYYY}">…
export class BmgAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:bmg';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('a[href^="/presse/pressemitteilungen/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!this.isValidLink(href)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText($(el).text());
      if (!title || title.length < 15) return;

      seen.add(url);

      // Datum aus URL extrahieren (Format: -pm-DD-MM-YYYY am Ende oder ähnlich)
      const dateFromUrl = href!.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
      let publishedAt: Date | null = null;
      if (dateFromUrl) {
        const [, d, m, y] = dateFromUrl;
        publishedAt = new Date(Date.UTC(+y, +m - 1, +d, 12));
      }

      // Fallback: Datum aus Parent-Element
      if (!publishedAt) {
        const parent = $(el).closest('article, li, [class*="news"], [class*="teaser"]');
        publishedAt = this.extractDate($(el));
      }

      items.push({
        externalId: url,
        title,
        url,
        publishedAt: publishedAt ?? new Date(),
      });
    });

    return items;
  }
}
