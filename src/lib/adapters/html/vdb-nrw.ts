import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://physio.nrw/
// Struktur: WordPress-Theme mit <article class="post"> — Link am Container, kein <h2><a>
export class VdbNrwAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:vdbNrw';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('article.post, .post').each((_, el) => {
      // Link direkt am Element oder im ersten <a>
      const link = $(el).is('a') ? $(el) : $(el).find('a[href]').first();
      const href = link.attr('href') ?? $(el).attr('href');
      if (!this.isValidLink(href)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('h1, h2, h3, .entry-title').first().text() || link.text() || $(el).text()
      );
      if (!title || title.length < 10) return;

      seen.add(url);

      const publishedAt = this.extractDate($(el)) ?? new Date();

      const summary = this.cleanText(
        $(el).find('.entry-summary, .entry-excerpt, .excerpt, p').first().text()
      );

      const img =
        $(el).find('img.wp-post-image').attr('src') ?? $(el).find('img').first().attr('src');

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
