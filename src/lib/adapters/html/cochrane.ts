import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.cochrane.de/news und /zusammenfassungen-physiotherapeuten
// Struktur: Drupal Views — .view-news .views-row mit Titel-Link + Datum (engl. "21 May 2026")
export class CochraneAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:cochrane';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      // Drupal View: .view-news (für /news) oder .view-id-* (für Zusammenfassungen)
      itemSelector: '.view-news .views-row, .view-id-news .views-row, [class*="view"] .views-row',
      titleSelector: 'h1, h2, h3, h4',
      minTitleLength: 10,
      summarySelector: '.field--name-body, .views-field-body, p',
      imageSelector: 'img',
    });
  }
}
