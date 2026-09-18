import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.g-ba.de/presse/pressemitteilungen/
// Struktur: Links zu /presse/pressemitteilungen/{id}/ — frei im body, nicht in <main>
export class GbaAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:gba';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'a[href*="/presse/pressemitteilungen/"], a[href*="pressemitteilung"]',
      rejectHref: [
        /\/pressemitteilungen\/?$/,
        /\/pressemitteilungen-meldungen\/?$/,
        /\?/, // Pagination, Sortierung und Filter
        /^#/,
      ],
      // Einzelne Pressemitteilungen tragen eine numerische ID am Ende.
      requireHref: /\/(\d+)\/?$/,
      titleSelector: 'h1, h2, h3, h4',
      minTitleLength: 15,
    });
  }
}
