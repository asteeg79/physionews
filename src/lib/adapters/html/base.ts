import * as cheerio from 'cheerio';
import type { Source } from '@/db/schema';
import type { RawNewsItem, SourceAdapter } from '../types';

export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
};

export abstract class HtmlScraperAdapter implements SourceAdapter {
  abstract readonly typeIdentifier: string;

  abstract parse(
    $: ReturnType<typeof cheerio.load>,
    url: string,
    source: Source
  ): RawNewsItem[];

  async fetch(source: Source): Promise<RawNewsItem[]> {
    const res = await fetch(source.url, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} für ${source.url}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    return this.parse($, source.url, source);
  }

  protected resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
  }

  protected cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  protected parseGermanDate(dateStr: string): Date | null {
    const clean = dateStr.trim();
    // Format: DD.MM.YYYY
    const match = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (match) {
      return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T12:00:00+01:00`);
    }
    // Versuche Standard-Datum-Parsing
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }
}
