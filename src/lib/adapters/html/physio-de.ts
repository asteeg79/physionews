import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://physio.de/community/news/archiv/99
// Struktur: <div class="flexchild-overview-liste">
//             <a class="link_subject" href="/community/news/{slug}/99/{id}/1">
//               Überschrift<br>Teaser…
//             </a>
// Überschrift und Teaser stehen ohne eigenes Element im selben Link, getrennt
// nur durch das <br> — daher splitTitleAtLineBreak.
export class PhysioDeAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:physioDe';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    return this.collectListItems($, baseUrl, {
      itemSelector: 'a[href*="/community/news/"]',
      // Archiv-, Filter- und Paginierungslinks tragen keinen Slug.
      rejectHref: [/\/community\/news\/archiv/, /\/community\/news\/?$/],
      splitTitleAtLineBreak: true,
      minTitleLength: 15,
      scopeSelector: '.flexchild-overview-liste',
      // Physio.de datiert relativ ("Vor 12 Stunden", "Gestern") in einem
      // Element, dessen Klassenname keines der üblichen Muster trifft.
      dateSelector: '.zeit_overview',
    });
  }
}
