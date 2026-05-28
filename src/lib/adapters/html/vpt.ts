import * as cheerio from 'cheerio';
import type { Source } from '@/db/schema';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Quelle: https://www.vpt.de/ und https://vpt-nrw.de/aktuelles/
// Struktur: Links mit href=/aktuelles/... oder Pfaden zu News
export class VptAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier: string = 'html:vpt';

  parse($: ReturnType<typeof cheerio.load>, baseUrl: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $(
      'a[href*="/aktuelles/"], a[href*="/news/"], a[href*="/artikel/"], a[href*="/meldungen/"]'
    ).each((_, el) => {
      const href = $(el).attr('href');
      if (!this.isValidLink(href)) return;

      // Übersichtsseiten überspringen (Pfad endet auf "/aktuelles/", "/news/")
      if (href!.match(/\/(aktuelles|news|artikel|meldungen)\/?$/)) return;
      if (href!.includes('?')) return; // Filter-URLs

      // VPT-spezifisch: echte News liegen unter /aktuelles/news-ansicht/ — Sidebar-Seiten überspringen
      // Wenn /aktuelles/ in href ist, fordern wir /news-ansicht/ als Marker
      if (href!.match(/\/aktuelles\/[^/]+\/?$/) && !href!.includes('/news-ansicht/')) {
        return;
      }

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      // Title aus h-Tags innerhalb, sonst Link-Text
      const title = this.cleanText(
        $(el).find('h1, h2, h3, h4').first().text() || $(el).text()
      );
      if (!title || title.length < 15) return;

      seen.add(url);

      const wrapper = $(el).closest('article, li, .news-item, .teaser');
      const dateText =
        wrapper.find('time').attr('datetime') ??
        wrapper.find('time').first().text() ??
        wrapper.find('[class*="date"], [class*="datum"]').first().text();
      const publishedAt = this.parseDate(dateText) ?? new Date();

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

// VPT-NRW nutzt den gleichen Selektor-Stil — separate Klasse für klarere Logs
export class VptNrwAdapter extends VptAdapter {
  readonly typeIdentifier = 'html:vpt-nrw';
}
