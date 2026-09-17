import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.ifk.de/verband/aktuelles
// Struktur: <article> mit h2/h3-Titel, Datum-Span und Link nach /artikel/...
export class IfkAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:ifk';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('article').each((_, el) => {
      const link = $(el).find('a[href*="/artikel/"]').first();
      const href = link.attr('href');
      if (!this.isValidLink(href)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('h1, h2, h3, h4').first().text() || link.text()
      );
      if (!title || title.length < 8) return;

      seen.add(url);

      const publishedAt = this.extractDate($(el)) ?? new Date();

      const summary = this.cleanText(
        $(el).find('p').not('[class*="meta"]').not('[class*="date"]').first().text()
      );

      const img = $(el).find('img').first().attr('src');

      items.push({
        externalId: url,
        title,
        summary: summary && summary.length > 20 ? summary : undefined,
        url,
        publishedAt,
        imageUrl: img ? this.resolveUrl(img, baseUrl) : undefined,
      });
    });

    return items;
  }
}
