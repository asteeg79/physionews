import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.g-ba.de/presse/pressemitteilungen/
// Struktur: Links zu /presse/pressemitteilungen/{id}/ — frei im body, nicht in <main>
export class GbaAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:gba';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('a[href*="/presse/pressemitteilungen/"], a[href*="pressemitteilung"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!this.isValidLink(href)) return;

      // Übersichtsseite und Filter-URLs überspringen
      if (href!.match(/\/pressemitteilungen\/?$/)) return;
      if (href!.match(/\/pressemitteilungen-meldungen\/?$/)) return;
      if (href!.match(/\/pressemitteilungen\/\?/)) return;
      if (href!.includes('?')) return; // Pagination und Sortierung
      if (href!.startsWith('#')) return;

      // Einzelne Pressemitteilungen haben numerische ID am Ende: /pressemitteilungen-meldungen/1234/
      if (!href!.match(/\/(\d+)\/?$/)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('h1, h2, h3, h4').first().text() || $(el).text()
      );
      if (!title || title.length < 15) return;

      seen.add(url);

      const wrapper = $(el).closest('article, li, .item, [class*="press"]');
      const publishedAt = this.extractDate($(el)) ?? new Date();

      items.push({
        externalId: url,
        title,
        url,
        publishedAt,
      });
    });

    return items;
  }
}
