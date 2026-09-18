import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.rechtsanwaltalt.de/aktuelles/ und /artikel/
// Jimdo CMS, zwei Listenformen:
//   /aktuelles/ — Blog-Einträge in .j-blogarticle, Datum im Pfad /YYYY/MM/DD/
//   /artikel/   — schlichte Linklisten in .j-module (früher ebenfalls
//                 .j-blogarticle; Jimdo hat die Auszeichnung ersetzt)
export class RaAltAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:raAlt';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: '.j-blogarticle, .j-module a[href^="/artikel/"]',
      // Die Übersichtsseite selbst verlinkt sich in der Navigation.
      rejectHref: [/^\/artikel\/?$/],
      titleSelector: '.j-blog-headline, h1, h2, h3',
      minTitleLength: 10,
      summarySelector: '.j-blog-content, .j-blog-text, p',
      imageSelector: 'img',
      // Blog-Pfade tragen das Datum: /2025/06/19/slug
      dateFromHref: /\/(\d{4})\/(\d{2})\/(\d{2})\//,
      dateFromHrefOrder: 'ymd',
    });
  }
}
