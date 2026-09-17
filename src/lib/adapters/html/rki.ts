import * as cheerio from 'cheerio';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.rki.de/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/...
// Struktur: <a href="/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/{slug}.html"> mit Teaser-Klassen
export class RkiAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier = 'html:rki';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('a[href*="/Meldungen-PM/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!this.isValidLink(href)) return;

      // Übersichtsseiten und Navigation überspringen
      if (href!.match(/-node\.html$/)) return;
      if (href!.match(/meldungen-pressemitteilungen-node/)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      // Titel aus Link-Text oder inneren h-Tags
      const title = this.cleanText(
        $(el).find('h1, h2, h3, h4').first().text() || $(el).text()
      );
      if (!title || title.length < 15) return;

      seen.add(url);

      const wrapper = $(el).closest('article, li, [class*="teaser"], [class*="news"]');
      const publishedAt = this.extractDate($(el)) ?? new Date();

      const summary = this.cleanText(
        wrapper.find('p').not('[class*="meta"]').first().text()
      );

      items.push({
        externalId: url,
        title,
        summary: summary && summary.length > 20 ? summary : undefined,
        url,
        publishedAt,
      });
    });

    return items;
  }
}
