import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.dvmt.de/
// Struktur: Statische Startseite mit News-Bereich — Selektor heuristisch
export class DvmtAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:dvmt';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector:
        'article, .news-item, .post, [class*="news"], a[href*="aktuelles"], a[href*="news"]',
      rejectHref: [/\/(news|aktuelles)\/?$/],
      titleSelector: 'h1, h2, h3',
      minTitleLength: 15,
    });
  }
}
