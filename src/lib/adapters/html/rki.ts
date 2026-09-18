import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.rki.de/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/...
// Struktur: <a href="/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/{slug}.html"> mit Teaser-Klassen
export class RkiAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:rki';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'a[href*="/Meldungen-PM/"]',
      rejectHref: [/-node\.html$/, /meldungen-pressemitteilungen-node/],
      titleSelector: 'h1, h2, h3, h4',
      minTitleLength: 15,
      scopeSelector: 'article, li, [class*="teaser"], [class*="news"]',
      summarySelector: 'p',
      summaryReject: ['[class*="meta"]'],
    });
  }
}
