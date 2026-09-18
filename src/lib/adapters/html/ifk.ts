import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.ifk.de/verband/aktuelles
// Struktur: <article> mit h2/h3-Titel, Datum-Span und Link nach /artikel/...
export class IfkAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:ifk';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'article',
      linkSelector: 'a[href*="/artikel/"]',
      titleSelector: 'h1, h2, h3, h4',
      minTitleLength: 8,
      summarySelector: 'p',
      summaryReject: ['[class*="meta"]', '[class*="date"]'],
      imageSelector: 'img',
    });
  }
}
