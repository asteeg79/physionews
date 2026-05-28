import * as cheerio from 'cheerio';
import type { Source } from '@/db/schema';
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
      const dateText =
        wrapper.find('time').attr('datetime') ??
        wrapper.find('time').first().text() ??
        wrapper.find('[class*="date"], [class*="datum"]').first().text();
      const publishedAt = this.parseDate(dateText) ?? new Date();

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
