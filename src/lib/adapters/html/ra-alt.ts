import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.rechtsanwaltalt.de/aktuelles/ und /artikel/
// Jimdo CMS — Blog-Artikel in .j-blogarticle Containern
export class RaAltAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:raAlt';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: '.j-blogarticle',
      titleSelector: '.j-blog-headline, h1, h2, h3',
      minTitleLength: 10,
      summarySelector: '.j-blog-content, .j-blog-text, p',
      imageSelector: 'img',
    });
  }
}
