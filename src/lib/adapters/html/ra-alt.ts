import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.rechtsanwaltalt.de/aktuelles/ und /artikel/
// Jimdo CMS — Blog-Artikel in .j-blogarticle Containern
export class RaAltAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:raAlt';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('.j-blogarticle').each((_, el) => {
      const link = $(el).find('a[href]').first();
      const href = link.attr('href');
      if (!this.isValidLink(href)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('.j-blog-headline, h1, h2, h3').first().text() || link.text()
      );
      if (!title || title.length < 10) return;

      seen.add(url);

      const publishedAt = this.extractDate($(el)) ?? new Date();

      const summary = this.cleanText(
        $(el).find('.j-blog-content, .j-blog-text, p').first().text()
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
