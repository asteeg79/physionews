import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.physio-deutschland.de/fachkreise/news-bundesweit.html
// Struktur: .item--teaser-content mit .item--title, .item--date--subline, /artikel/{slug}
export class PhysioDeutschlandAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:physioDeutschland';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    // News-Items im teaser-Container
    $('.item--teaser-content, .news-list-browse .item, .meldung').each((_, el) => {
      const link = $(el).find('a[href*="artikel/"], a[href*="/news"]').first();
      const href = link.attr('href') ?? $(el).find('a[href]').first().attr('href');
      if (!this.isValidLink(href)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('.item--title, h1, h2, h3').first().text() || link.text()
      );
      if (!title || title.length < 10) return;

      seen.add(url);

      const publishedAt = this.extractDate($(el)) ?? new Date();

      const summary = this.cleanText(
        $(el).find('.item--bodytext, .item--text, p').first().text()
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
