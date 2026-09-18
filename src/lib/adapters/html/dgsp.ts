import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.dgsp.de/news/
// Struktur: <li><a href="/news/1/{id}/nachrichten/{slug}.html">{title}</a></li>
export class DgspAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:dgsp';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'a[href^="/news/1/"], a[href*="/nachrichten/"]',
      minTitleLength: 15,
    });
  }
}
