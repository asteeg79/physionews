import * as cheerio from 'cheerio';
import type { Source } from '@/db/schema';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Ziel: https://www.ifk.de/verband/aktuelles
// Struktur: Liste von Artikeln mit Datum, Titel und Link
export class IfkAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:ifk';

  parse($: ReturnType<typeof cheerio.load>, url: string, _source: Source): RawNewsItem[] {
    const items: RawNewsItem[] = [];

    // Typische CMS-Strukturen — wird in Phase 3 nach HTML-Inspektion verfeinert
    $('article, .news-item, .teaser, [class*="article"], [class*="news"]').each((_, el) => {
      const link = $(el).find('a').first();
      const href = link.attr('href');
      if (!href) return;

      const title = this.cleanText(
        link.text() || $(el).find('h2, h3, h4').first().text()
      );
      if (!title) return;

      const dateText = $(el).find('time, .date, [class*="date"]').first().attr('datetime')
        ?? $(el).find('time, .date, [class*="date"]').first().text();
      const publishedAt = dateText ? this.parseGermanDate(dateText) ?? new Date() : new Date();

      const summary = this.cleanText(
        $(el).find('p, .summary, .teaser-text').first().text()
      );

      items.push({
        externalId: this.resolveUrl(href, url),
        title,
        summary: summary || undefined,
        url: this.resolveUrl(href, url),
        publishedAt,
      });
    });

    return items;
  }
}
