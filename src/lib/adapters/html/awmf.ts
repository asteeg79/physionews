import * as cheerio from 'cheerio';
import type { Source } from '@/db/schema';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://register.awmf.org/de/leitlinien/aktuelle-leitlinien
// HINWEIS: Seite wird per JavaScript gerendert (initial nur ~7KB ohne Inhalt).
// Ohne Browser-Engine (Playwright) lassen sich keine Leitlinien-Items extrahieren.
// Workaround: Wir versuchen JSON-LD/Static-Markup; bei leerem Ergebnis loggen wir die Limitation.
export class AwmfAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:awmf';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('a[href*="/leitlinien/"], .leitlinien-item, .guideline-item, article').each((_, el) => {
      const link = $(el).is('a') ? $(el) : $(el).find('a[href*="/leitlinien/"]').first();
      const href = link.attr('href');
      if (!this.isValidLink(href)) return;

      // Übersichtsseiten überspringen
      if (href!.match(/\/leitlinien\/?$/) || href!.match(/\/aktuelle-leitlinien\/?$/)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const title = this.cleanText(
        $(el).find('h1, h2, h3').first().text() || link.text()
      );
      if (!title || title.length < 15) return;

      seen.add(url);

      const wrapper = $(el).closest('li, article, .leitlinien-item, [class*="guideline"]');
      const dateText =
        wrapper.find('time').attr('datetime') ??
        wrapper.find('time').first().text() ??
        wrapper.find('[class*="date"], [class*="datum"]').first().text();
      const publishedAt = this.parseDate(dateText) ?? new Date();

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
