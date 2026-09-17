import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.dvmt.de/
// Struktur: Statische Startseite mit News-Bereich — Selektor heuristisch
export class DvmtAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:dvmt';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('article, .news-item, .post, [class*="news"], a[href*="aktuelles"], a[href*="news"]').each((_, el) => {
      const link = $(el).is('a') ? $(el) : $(el).find('a[href]').first();
      const href = link.attr('href');
      if (!this.isValidLink(href)) return;

      // Übersichtsseiten überspringen
      if (href!.match(/\/(news|aktuelles)\/?$/)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('h1, h2, h3').first().text() || link.text()
      );
      if (!title || title.length < 15) return;

      seen.add(url);

      const wrapper = $(el).is('a') ? $(el).parent() : $(el);
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
