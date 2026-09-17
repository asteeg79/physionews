import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.dgsp.de/news/
// Struktur: <li><a href="/news/1/{id}/nachrichten/{slug}.html">{title}</a></li>
export class DgspAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:dgsp';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('a[href^="/news/1/"], a[href*="/nachrichten/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!this.isValidLink(href)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText($(el).text());
      if (!title || title.length < 15) return;

      seen.add(url);

      // Datum aus Sibling oder Parent
      const wrapper = $(el).closest('li, article, .news-item, .entry');
      const publishedAt = this.extractDate($(el)) ?? new Date();

      items.push({
        externalId: url,
        title,
        url,
        publishedAt,
      });
    });

    return items;
  }
}
