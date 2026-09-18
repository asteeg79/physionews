import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.physio-deutschland.de/fachkreise/news-bundesweit.html
// Struktur: .item--teaser-content mit .item--title, .item--date--subline, /artikel/{slug}
export class PhysioDeutschlandAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:physioDeutschland';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: '.item--teaser-content, .news-list-browse .item, .meldung',
      linkSelector: 'a[href*="artikel/"], a[href*="/news"]',
      linkFallbackSelector: 'a[href]',
      titleSelector: '.item--title, h1, h2, h3',
      minTitleLength: 10,
      summarySelector: '.item--bodytext, .item--text, p',
      imageSelector: 'img',
    });
  }
}
