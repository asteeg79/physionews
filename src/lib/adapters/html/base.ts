import * as cheerio from 'cheerio';
import { isPlausiblePublishDate } from '../../publish-date';
import type { Source } from '@/data/types';
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

/**
 * Obergrenze für die Datumssuche im freien Text. Umfasst der Block mehr
 * Zeichen, gehört das erste Datum darin vermutlich nicht zu diesem Item.
 */
const MAX_DATE_SCAN_CHARS = 600;

/** Wie viele Ebenen über dem Treffer noch nach einem Datum gesucht wird. */
const MAX_DATE_ANCESTOR_DEPTH = 6;

/** Minimale Sicht auf einen DOM-Knoten, wie cheerio ihn liefert. */
interface TextNode {
  type?: string;
  data?: string;
  children?: TextNode[];
}

/**
 * Sammelt den Text eines Teilbaums — bricht aber ab, sobald absehbar mehr
 * als `limit` Zeichen zusammenkommen.
 *
 * Vorher wurde `$scope.text()` aufgerufen und das Ergebnis erst danach
 * gegen die Grenze geprüft — auf den oberen Ebenen also der Text der halben
 * Seite, nur um ihn zu verwerfen.
 *
 * Auf den Test-Fixtures ist das nicht messbar: dort findet sich das Datum
 * meist schon auf der ersten oder zweiten Ebene. Der Zweck ist die obere
 * Schranke — eine unbegrenzte Operation auf fremdem Markup wird zu einer
 * begrenzten, unabhängig davon, wie groß die Seite ist.
 *
 * @returns Der normalisierte Text, oder `null`, wenn er die Grenze reißt.
 */
function collectTextUpTo(node: TextNode | undefined, limit: number): string | null {
  if (!node) return null;

  // Großzügige Rohgrenze: Whitespace schrumpft beim Normalisieren, die
  // genaue Prüfung passiert danach.
  const rawLimit = limit * 4;
  const parts: string[] = [];
  let raw = 0;

  const walk = (n: TextNode): boolean => {
    if (n.type === 'text') {
      const chunk = n.data ?? '';
      raw += chunk.length;
      if (raw > rawLimit) return false;
      parts.push(chunk);
      return true;
    }
    for (const child of n.children ?? []) {
      if (!walk(child)) return false;
    }
    return true;
  };

  if (!walk(node)) return null;

  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : null;
}

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
    const parsed = this.parseDateRaw(input);
    return parsed && isPlausiblePublishDate(parsed) ? parsed : null;
  }

  /** Die eigentliche Formaterkennung — ohne Plausibilitätsprüfung. */
  private parseDateRaw(input: string | null | undefined): Date | null {
    if (!input) return null;
    // Whitespace zusammenfassen, nicht nur trimmen: gescrapte Datumsangaben
    // enthalten oft Zeilenumbrüche und Tabs. Nebeneffekt — die `\s`-Gruppen
    // der Muster unten können danach nie mehr als ein Zeichen greifen, was
    // quadratisches Backtracking bei langen Leerzeichenfolgen ausschließt.
    const clean = input.replace(/\s+/g, ' ').trim();
    if (!clean) return null;

    // DD/MM/YYYY — MUSS vor `new Date()` stehen: JavaScript liest
    // "05/06/2026" amerikanisch als 6. Mai statt als 5. Juni. Deutsche
    // Quellen meinen Tag/Monat (z. B. VPT: datetime="27/05/2026").
    const slashMatch = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(clean);
    if (slashMatch) {
      const [, first, second, y] = slashMatch;
      // Ist die erste Zahl > 12, kann sie nur der Tag sein; ist die zweite
      // > 12, muss es umgekehrt sein. Sonst gilt die deutsche Lesart.
      const [d, m] = +second > 12 ? [second, first] : [first, second];
      return new Date(Date.UTC(+y, +m - 1, +d, 12));
    }

    // ISO-Datum oder direkt parsebar
    const iso = new Date(clean);
    if (!Number.isNaN(iso.getTime()) && /\d{4}/.test(clean)) return iso;

    // DD.MM.YYYY
    const dotMatch = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(clean);
    if (dotMatch) {
      const [, d, m, y] = dotMatch;
      return new Date(Date.UTC(+y, +m - 1, +d, 12));
    }

    // 14. Januar 2025 oder 14. Jan. 2025
    const deMatch = /(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜß]+)\.?\s+(\d{4})/.exec(clean);
    if (deMatch) {
      const [, d, monName, y] = deMatch;
      const m = MONTHS_DE[monName.toLowerCase()];
      if (m !== undefined) return new Date(Date.UTC(+y, m, +d, 12));
    }

    // 14 May 2026
    const enMatch = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(clean);
    if (enMatch) {
      const [, d, monName, y] = enMatch;
      const m = MONTHS_EN[monName.toLowerCase()];
      if (m !== undefined) return new Date(Date.UTC(+y, m, +d, 12));
    }

    // Jan 14, 2026
    // {3,9} statt +: Monatsnamen sind zwischen 'Jan' und 'September' lang.
    // Unbegrenzt könnte die Gruppe bei einer langen Buchstabenfolge über
    // jede Startposition zurücklaufen — quadratische Laufzeit.
    const enMatch2 = /\b([A-Za-z]{3,9})\b\s{1,3}(\d{1,2}),?\s{1,3}(\d{4})/.exec(clean);
    if (enMatch2) {
      const [, monName, d, y] = enMatch2;
      const m = MONTHS_EN[monName.toLowerCase()];
      if (m !== undefined) return new Date(Date.UTC(+y, m, +d, 12));
    }

    return null;
  }

  /**
   * Sucht das Veröffentlichungsdatum im Umfeld eines Treffers.
   *
   * Reihenfolge: `<time datetime>` → Text des `<time>` → Element mit
   * `date`/`datum` in der Klasse → freier Text des Umfelds.
   *
   * Der letzte Schritt ist der wichtige: viele Quellen schreiben das Datum
   * als gewöhnlichen Text („Erschienen am 28.05.2026"), ohne jede Auszeichnung.
   * Ohne ihn fielen rund 70 % aller Items auf den Abrufzeitpunkt zurück —
   * mit Folgen für Zeit-Gruppierung, Retention und Top-News-Auswahl.
   *
   * Findet sich im übergebenen Block nichts, wird bis zu
   * `MAX_DATE_ANCESTOR_DEPTH` Ebenen nach oben weitergesucht — je nach Quelle
   * steht das Datum als Geschwister des Links, nicht darin.
   *
   * Der Text wird nur bis `MAX_DATE_SCAN_CHARS` durchsucht: in einem großen
   * Block wäre das erste gefundene Datum womöglich das eines anderen Beitrags.
   * Diese Grenze begrenzt zugleich die Suche nach oben — sobald der Block zu
   * groß wird, liefert er nichts mehr.
   */
  protected extractDate($scope: cheerio.Cheerio): Date | null {
    let node = $scope;
    for (let depth = 0; depth < MAX_DATE_ANCESTOR_DEPTH && node.length > 0; depth++) {
      const found = this.dateFromScope(node);
      if (found) return found;
      node = node.parent();
    }
    return null;
  }

  /**
   * Sucht ein Datum genau in einem Block — ohne die Vorfahren einzubeziehen.
   *
   * Reihenfolge: `<time datetime>` → Text des `<time>` → Element mit
   * `date`/`datum` in der Klasse → freier Text des Blocks.
   */
  private dateFromScope($scope: cheerio.Cheerio): Date | null {
    // `find('time')` einmal ausführen statt zweimal denselben Teilbaum zu
    // durchlaufen — ohne <time> lieferte der erste Ausdruck nur null.
    const times = $scope.find('time');
    const direct =
      this.parseDate(times.attr('datetime')) ??
      this.parseDate(times.first().text()) ??
      this.parseDate(
        $scope.find('[class*="date"], [class*="datum"], [class*="published"]').first().text()
      );
    if (direct) return direct;

    const text = collectTextUpTo($scope[0] as unknown as TextNode, MAX_DATE_SCAN_CHARS);
    return text === null ? null : this.parseDate(text);
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
