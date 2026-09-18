import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.bundesgesundheitsministerium.de/presse/pressemitteilungen
// Struktur: <h3 class="u-typo:l u-typo:bold"><a href="/presse/pressemitteilungen/{slug}-pm-{DD-MM-YYYY}">…
export class BmgAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:bmg';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'a[href^="/presse/pressemitteilungen/"]',
      minTitleLength: 15,
      // BMG führt das Datum in der URL: …-pm-DD-MM-YYYY
      dateFromHref: /(\d{1,2})-(\d{1,2})-(\d{4})/,
    });
  }
}
