import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.cochrane.de/news und /zusammenfassungen-physiotherapeuten
// Struktur: Drupal Views — .view-news .views-row mit Titel-Link + Datum (engl. "21 May 2026")
export class CochraneAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:cochrane';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    // Drupal View: .view-news (für /news) oder .view-id-* (für Zusammenfassungen)
    const rows = $('.view-news .views-row, .view-id-news .views-row, [class*="view"] .views-row');

    rows.each((_, el) => {
      const link = $(el).find('a[href]').first();
      const href = link.attr('href');
      if (!this.isValidLink(href)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('h1, h2, h3, h4').first().text() || link.text()
      );
      if (!title || title.length < 10) return;

      seen.add(url);

      const dateText =
        $(el).find('time').attr('datetime') ??
        $(el).find('time').first().text() ??
        $(el).find('.field--name-field-date, [class*="date"], [class*="created"]').first().text();
      const publishedAt = this.parseDate(dateText) ?? new Date();

      const summary = this.cleanText(
        $(el).find('.field--name-body, .views-field-body, p').first().text()
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
