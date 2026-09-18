import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://physio.nrw/
// Struktur: WordPress-Theme mit <article class="post"> — Link am Container, kein <h2><a>
export class VdbNrwAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:vdbNrw';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'article.post, .post',
      titleSelector: 'h1, h2, h3, .entry-title',
      titleFromContainer: true,
      minTitleLength: 10,
      summarySelector: '.entry-summary, .entry-excerpt, .excerpt, p',
      preferredImageSelector: 'img.wp-post-image',
      imageSelector: 'img',
    });
  }
}
