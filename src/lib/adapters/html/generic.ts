import * as cheerio from 'cheerio';
import type { Source } from '@/db/schema';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Generischer Adapter für einfache Newsseiten.
// Versucht gängige CMS-Strukturen — wird in Phase 3 pro Quelle durch spezifische Adapter ersetzt.
export class GenericHtmlAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier: string;

  constructor(typeId: string) {
    super();
    this.typeIdentifier = typeId;
  }

  parse($: ReturnType<typeof cheerio.load>, url: string, _source: Source): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    const selectors = [
      'article',
      '.news-item',
      '.post',
      '.entry',
      '.teaser',
      '[class*="news-list"] li',
      '[class*="article-list"] li',
      '.list-item',
    ];

    for (const selector of selectors) {
      if ($(selector).length > 0) {
        $(selector).each((_, el) => {
          const link = $(el).find('a[href]').first();
          const href = link.attr('href');
          if (!href) return;

          const resolved = this.resolveUrl(href, url);
          if (seen.has(resolved)) return;
          seen.add(resolved);

          const title = this.cleanText(
            $(el).find('h1, h2, h3, h4').first().text() || link.text()
          );
          if (!title || title.length < 5) return;

          const dateText =
            $(el).find('time').attr('datetime') ??
            $(el).find('time').text() ??
            $(el).find('[class*="date"], [class*="datum"]').first().text();
          const publishedAt = dateText ? (this.parseGermanDate(dateText) ?? new Date()) : new Date();

          const summary = this.cleanText(
            $(el).find('p, .summary, .excerpt, .teaser-text, .beschreibung').first().text()
          );

          const img = $(el).find('img').first().attr('src');

          items.push({
            externalId: resolved,
            title,
            summary: summary || undefined,
            url: resolved,
            publishedAt,
            imageUrl: img ? this.resolveUrl(img, url) : undefined,
          });
        });

        if (items.length > 0) break; // Ersten passenden Selektor verwenden
      }
    }

    return items;
  }
}
