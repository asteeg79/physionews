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
const DAY_MS = 86_400_000;
/** Monat und Jahr gerundet — relative Angaben sind selbst nur Näherungen. */
const RELATIVE_UNITS_MS: Record<string, number> = {
  minute: 60_000,
  stunde: 3_600_000,
  tag: DAY_MS,
  woche: 7 * DAY_MS,
  monat: 30 * DAY_MS,
  jahr: 365 * DAY_MS,
};

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

/**
 * Beschreibung einer Übersichtsseite: was die 13 quellenspezifischen
 * Adapter voneinander unterscheidet.
 *
 * Der Ablauf drumherum — Container finden, Link prüfen, URL auflösen,
 * deduplizieren, Titel bilden, Datum suchen, Summary und Bild ziehen — war
 * vorher in jedem Adapter einzeln ausgeschrieben. Rund 300 der 340 Zeilen in
 * diesem Verzeichnis waren Kopien, und sie waren bereits auseinandergelaufen:
 * die Mindest-Titellänge schwankte zwischen 8, 10 und 15, ohne dass ein
 * Grund erkennbar gewesen wäre.
 */
export interface ListPageSpec {
  /**
   * Container je Beitrag. Trifft der Selektor direkt ein `<a>`, gilt dieses
   * zugleich als Link — mehrere Quellen listen ihre Beiträge so.
   */
  itemSelector: string;
  /** Link innerhalb des Containers. Ohne Angabe das erste `<a href>`. */
  linkSelector?: string;
  /** Greift `linkSelector` nicht, wird hiermit noch einmal gesucht. */
  linkFallbackSelector?: string;
  /** href-Muster, die übersprungen werden — Übersichts- und Filterseiten. */
  rejectHref?: RegExp[];
  /** href MUSS dieses Muster erfüllen, sonst wird übersprungen. */
  requireHref?: RegExp;
  /** Quellenspezifische Ausschlussregel für Fälle, die kein Muster abdeckt. */
  rejectLink?: (href: string) => boolean;
  /** Überschrift im Container. Fällt auf den Linktext zurück. */
  titleSelector?: string;
  /** Zusätzlich auf den Text des Containers zurückfallen. */
  titleFromContainer?: boolean;
  minTitleLength: number;
  /** Bereich für Summary und Bild — ohne Angabe der Container selbst. */
  scopeSelector?: string;
  summarySelector?: string;
  /** Absätze, die als Summary ausscheiden (Meta- und Datumszeilen). */
  summaryReject?: string[];
  imageSelector?: string;
  /** Bevorzugtes Bild; greift es nicht, gilt `imageSelector`. */
  preferredImageSelector?: string;
  /** Datumselement im Scope, falls es die üblichen Klassennamen verfehlt. */
  dateSelector?: string;
  /** Datum aus der URL ziehen, z. B. `/thema-14-05-2026/` → drei Zifferngruppen. */
  dateFromHref?: RegExp;
  /** Reihenfolge der Gruppen in `dateFromHref`. Ohne Angabe Tag-Monat-Jahr. */
  dateFromHrefOrder?: 'dmy' | 'ymd';
  /**
   * Überschrift und Teaser stehen unformatiert im selben Link, getrennt nur
   * durch ein `<br>` (so listet z. B. Physio.de). Der Titel endet dann am
   * ersten Umbruch, der Rest wird zur Summary — ohne die Aufteilung wäre
   * der Titel der komplette Absatz.
   */
  splitTitleAtLineBreak?: boolean;
}

/** Ab dieser Länge gilt ein Absatz als brauchbare Zusammenfassung. */
const MIN_SUMMARY_LENGTH = 20;


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

  /**
   * "Vor 4 Tagen", "Vor einer Woche", "Gestern" — gerechnet ab jetzt.
   * Auf Wort- und Zahlformen beschränkt, die eine Einheit nennen, damit
   * gewöhnliches "vor allem" im Fließtext nicht als Datum durchgeht.
   */
  private parseRelativeDe(clean: string): Date | null {
    const lower = clean.toLowerCase();
    if (/\bheute\b/.test(lower)) return new Date();
    if (/\bvorgestern\b/.test(lower)) return new Date(Date.now() - 2 * DAY_MS);
    if (/\bgestern\b/.test(lower)) return new Date(Date.now() - DAY_MS);

    const m = /\bvor\s+(\d{1,3}|einer|einem)\s+(minute|stunde|tag|woche|monat|jahr)/.exec(lower);
    if (!m) return null;
    const amount = /^\d+$/.test(m[1]) ? +m[1] : 1;
    return new Date(Date.now() - amount * RELATIVE_UNITS_MS[m[2]]);
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

    // Relative Angaben — deutsche Community-Seiten datieren so (Physio.de:
    // "Vor 12 Stunden", "Gestern", "Vor einer Woche"). Ohne diese Zweige
    // bliebe nur der Abrufzeitpunkt als Datum übrig.
    const relative = this.parseRelativeDe(clean);
    if (relative) return relative;

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

    // DD-MM-YYYY — ebenfalls vor `new Date()`: "08-09-2026" liest JavaScript
    // amerikanisch als 9. August statt als 8. September (VPT-NRW-Newsarchiv).
    // Das vierstellige Jahr steht am Ende, ISO-Daten (2026-09-08) greift das
    // Muster daher nicht — deren Jahr steht vorn.
    const dashMatch = /(?:^|\D)(\d{1,2})-(\d{1,2})-(\d{4})(?:\D|$)/.exec(clean);
    if (dashMatch) {
      const [, first, second, y] = dashMatch;
      const [d, m] = +second > 12 ? [second, first] : [first, second];
      return new Date(Date.UTC(+y, +m - 1, +d, 12));
    }

    // ISO- und RFC-2822-Angaben — aber nur diese. Auf freien Text losgelassen
    // erfindet V8s Fallback-Parser Daten: `new Date('VPT NRW Online Stammtisch
    // am 01.10.2026')` ergibt den 9. Januar 2026. Überschriften mit Jahreszahl
    // sind in Nachrichtenlisten die Regel, nicht die Ausnahme.
    if (/^\d{4}-\d{1,2}-\d{1,2}([T ]|$)/.test(clean) || /^[A-Za-z]{3},\s/.test(clean)) {
      const iso = new Date(clean);
      if (!Number.isNaN(iso.getTime())) return iso;
    }

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
   * Liest eine Übersichtsseite nach der übergebenen Beschreibung aus.
   *
   * Enthält den Ablauf, den vorher jeder Adapter einzeln ausgeschrieben hat.
   * Die Adapter bleiben als benannte Klassen bestehen und liefern nur noch
   * ihr Quellenwissen — so ist an einer Stelle sichtbar, was eine Quelle
   * besonders macht, statt zwischen Boilerplate versteckt.
   */
  protected collectListItems(
    $: ReturnType<typeof cheerio.load>,
    baseUrl: string,
    spec: ListPageSpec
  ): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $(spec.itemSelector).each((_, el) => {
      const $el = $(el);

      // Trifft der Container-Selektor direkt ein <a>, ist es der Link selbst.
      let link = $el.is('a')
        ? $el
        : $el.find(spec.linkSelector ?? 'a[href]').first();
      if (link.length === 0 && spec.linkFallbackSelector) {
        link = $el.find(spec.linkFallbackSelector).first();
      }

      const href = link.attr('href') ?? $el.attr('href');
      if (!this.isValidLink(href)) return;
      if (spec.rejectHref?.some((re) => re.test(href!))) return;
      if (spec.requireHref && !spec.requireHref.test(href!)) return;
      if (spec.rejectLink?.(href!)) return;

      const url = this.resolveUrl(href!, baseUrl);
      if (seen.has(url)) return;

      const heading = spec.titleSelector
        ? this.cleanText($el.find(spec.titleSelector).first().text())
        : '';
      const split = spec.splitTitleAtLineBreak ? this.splitAtLineBreak($, link) : null;
      const title =
        heading ||
        split?.head ||
        this.cleanText(link.text()) ||
        (spec.titleFromContainer ? this.cleanText($el.text()) : '');
      if (!title || title.length < spec.minTitleLength) return;

      seen.add(url);

      const scope = spec.scopeSelector ? $el.closest(spec.scopeSelector) : $el;
      const publishedAt =
        this.dateFromHref(href!, spec.dateFromHref, spec.dateFromHrefOrder) ??
        (spec.dateSelector
          ? this.parseDate(scope.find(spec.dateSelector).first().text())
          : null) ??
        this.extractDate($el) ??
        new Date();

      let summary: string | undefined;
      if (spec.summarySelector) {
        let paragraphs = scope.find(spec.summarySelector);
        for (const reject of spec.summaryReject ?? []) paragraphs = paragraphs.not(reject);
        const text = this.cleanText(paragraphs.first().text());
        summary = text.length > MIN_SUMMARY_LENGTH ? text : undefined;
      }
      if (!summary && split && split.tail.length > MIN_SUMMARY_LENGTH) {
        summary = split.tail;
      }

      let imageUrl: string | undefined;
      if (spec.imageSelector || spec.preferredImageSelector) {
        const img =
          (spec.preferredImageSelector
            ? scope.find(spec.preferredImageSelector).first().attr('src')
            : undefined) ?? scope.find(spec.imageSelector ?? 'img').first().attr('src');
        imageUrl = img ? this.resolveUrl(img, baseUrl) : undefined;
      }

      items.push({ title, summary, url, publishedAt, imageUrl });
    });

    return items;
  }

  /**
   * Zieht ein Datum aus der URL, sofern die Quelle es dort führt.
   *
   * Die Gruppen werden direkt als Tag, Monat, Jahr gelesen — NICHT über
   * `parseDate` als Zeichenkette. Dort greift zuerst `new Date(clean)`, und
   * V8 liest "1.3.2026" amerikanisch als 3. Januar statt als 1. März.
   */
  /**
   * Zerlegt einen Link, der Überschrift und Teaser durch ein `<br>` trennt.
   * Ohne `<br>` steht alles im Kopfteil und `tail` bleibt leer.
   */
  private splitAtLineBreak(
    $: ReturnType<typeof cheerio.load>,
    link: cheerio.Cheerio
  ): { head: string; tail: string } {
    const parts: string[] = ['', ''];
    let idx = 0;
    link.contents().each((_, node) => {
      if (idx === 0 && node.type === 'tag' && node.name === 'br') {
        idx = 1;
        return;
      }
      parts[idx] += $(node).text();
    });
    return { head: this.cleanText(parts[0]), tail: this.cleanText(parts[1]) };
  }

  private dateFromHref(
    href: string,
    pattern?: RegExp,
    order: 'dmy' | 'ymd' = 'dmy'
  ): Date | null {
    if (!pattern) return null;
    const m = pattern.exec(href);
    if (!m) return null;
    // Beide Reihenfolgen kommen vor: BMG hängt `-pm-14-05-2026` an den Slug,
    // Blog-Systeme legen ihre Beiträge unter /2026/05/14/slug ab.
    const [d, mo, y] = order === 'ymd' ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
    const date = new Date(Date.UTC(+y, +mo - 1, +d, 12));
    return isPlausiblePublishDate(date) ? date : null;
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
      // dateFromScope liefert nur plausible Daten (parseDate prüft das),
      // künftige Veranstaltungsdaten aus der Überschrift fallen also schon
      // dort heraus und die Suche läuft weiter nach oben.
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
