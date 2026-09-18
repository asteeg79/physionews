import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.vpt.de/ und https://vpt-nrw.de/aktuelles/
// Struktur: Links mit href=/aktuelles/... oder Pfaden zu News
export class VptAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier: string = 'html:vpt';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector:
        'a[href*="/aktuelles/"], a[href*="/news/"], a[href*="/artikel/"], a[href*="/meldungen/"]',
      rejectHref: [/\/(aktuelles|news|artikel|meldungen)\/?$/, /\?/],
      // VPT-spezifisch: echte News liegen unter /aktuelles/news-ansicht/.
      // Andere Seiten direkt unter /aktuelles/ sind Sidebar-Inhalte.
      rejectLink: (href) =>
        /\/aktuelles\/[^/]+\/?$/.test(href) && !href.includes('/news-ansicht/'),
      titleSelector: 'h1, h2, h3, h4',
      minTitleLength: 15,
      scopeSelector: 'article, li, .news-item, .teaser',
      summarySelector: 'p',
      summaryReject: ['[class*="meta"]'],
    });
  }
}

/**
 * VPT NRW listet seine Meldungen im Newsarchiv in einem eigenen Raster
 * (.newslistitem > .col-9 > .header > h3 > a) und verlinkt dabei auf die
 * Landesgruppen-Domain vpt-nord-west.de. Deren Datum steht als DD-MM-YYYY
 * im Kopf der Kachel, nicht im Link.
 */
export class VptNrwAdapter extends VptAdapter {
  readonly typeIdentifier = 'html:vpt-nrw';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: '.newslistitem .header h3 a, .news-list-view .header h3 a',
      minTitleLength: 15,
      scopeSelector: '.newslistitem',
      summarySelector: '.teaser, p',
      summaryReject: ['[class*="meta"]', '[class*="date"]'],
      imageSelector: 'img',
    });
  }
}
