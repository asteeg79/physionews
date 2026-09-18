import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://register.awmf.org/de/leitlinien/aktuelle-leitlinien
// HINWEIS: Seite wird per JavaScript gerendert (initial nur ~7KB ohne Inhalt).
// Ohne Browser-Engine (Playwright) lassen sich keine Leitlinien-Items extrahieren.
// Workaround: Wir versuchen JSON-LD/Static-Markup; bei leerem Ergebnis loggen wir die Limitation.
export class AwmfAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:awmf';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'a[href*="/leitlinien/"], .leitlinien-item, .guideline-item, article',
      linkSelector: 'a[href*="/leitlinien/"]',
      rejectHref: [/\/leitlinien\/?$/, /\/aktuelle-leitlinien\/?$/],
      titleSelector: 'h1, h2, h3',
      minTitleLength: 15,
    });
  }
}
