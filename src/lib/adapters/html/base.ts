import * as cheerio from 'cheerio';
import type { Source } from '@/db/schema';
import type { RawNewsItem, SourceAdapter } from '../types';

export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
};

const MONTHS_DE: Record<string, number> = {
  januar: 0, februar: 1, märz: 2, maerz: 2, april: 3, mai: 4, juni: 5, juli: 6,
  august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
  jan: 0, feb: 1, mär: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, okt: 9, nov: 10, dez: 11,
};

const MONTHS_EN: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

export abstract class HtmlScraperAdapter implements SourceAdapter {
  abstract readonly typeIdentifier: string;

  abstract parse(
    $: ReturnType<typeof cheerio.load>,
    url: string,
    source: Source
  ): RawNewsItem[];

  async fetch(source: Source): Promise<RawNewsItem[]> {
    const res = await globalThis.fetch(source.url, {
      headers: this.requestHeaders(),
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} für ${source.url}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    return this.parse($, source.url, source);
  }

  /** Override in subclasses if special headers are needed */
  protected requestHeaders(): Record<string, string> {
    return DEFAULT_HEADERS;
  }

  protected resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
  }

  protected cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Parsen deutscher und englischer Datumsformate.
   * - ISO: 2025-01-14, 2025-01-14T12:00:00Z
   * - Deutsch: 14.01.2025, 14. Januar 2025, 14. Jan. 2025
   * - Englisch: 14 January 2025, Jan 14, 2025, 14 May 2026
   */
  protected parseDate(input: string | null | undefined): Date | null {
    if (!input) return null;
    const clean = input.trim();
    if (!clean) return null;

    // ISO-Datum oder direkt parsebar
    const iso = new Date(clean);
    if (!isNaN(iso.getTime()) && clean.match(/\d{4}/)) return iso;

    // DD.MM.YYYY
    const dotMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotMatch) {
      const [, d, m, y] = dotMatch;
      return new Date(Date.UTC(+y, +m - 1, +d, 12));
    }

    // 14. Januar 2025 oder 14. Jan. 2025
    const deMatch = clean.match(/(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜß]+)\.?\s+(\d{4})/);
    if (deMatch) {
      const [, d, monName, y] = deMatch;
      const m = MONTHS_DE[monName.toLowerCase()];
      if (m !== undefined) return new Date(Date.UTC(+y, m, +d, 12));
    }

    // 14 May 2026
    const enMatch = clean.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (enMatch) {
      const [, d, monName, y] = enMatch;
      const m = MONTHS_EN[monName.toLowerCase()];
      if (m !== undefined) return new Date(Date.UTC(+y, m, +d, 12));
    }

    // Jan 14, 2026
    const enMatch2 = clean.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (enMatch2) {
      const [, monName, d, y] = enMatch2;
      const m = MONTHS_EN[monName.toLowerCase()];
      if (m !== undefined) return new Date(Date.UTC(+y, m, +d, 12));
    }

    return null;
  }

  /**
   * Wandelt einen relativen oder absoluten Link in eine vollständige URL.
   * Filtert javascript:- und mailto:-Links.
   */
  protected isValidLink(href: string | undefined | null): boolean {
    if (!href) return false;
    const lower = href.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('mailto:') || lower.startsWith('#')) return false;
    return true;
  }
}
