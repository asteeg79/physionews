import * as cheerio from 'cheerio';
import type { Source } from '@/data/types';
import type { RawNewsItem } from '../types';
import { HtmlScraperAdapter } from './base';

// Generischer HTML-Adapter für unbekannte Newsseiten.
// 1. Versucht JSON-LD (schema.org Article/NewsArticle/BlogPosting) — sehr zuverlässig wenn vorhanden
// 2. Fallback: heuristische DOM-Suche mit Junk-Filter

/** Wie viele Ebenen ein Treffer höchstens erweitert wird. */
const MAX_WIDEN_DEPTH = 3;

const MIN_TITLE_LENGTH = 12;

const JUNK_TITLES = new Set([
  'drucken',
  'senden',
  'teilen',
  'kommentieren',
  'mehr',
  'mehr lesen',
  'weiterlesen',
  'nach oben',
  'zurück',
  'startseite',
  'home',
  'login',
  'anmelden',
  'registrieren',
  'newsletter',
  'kontakt',
  'impressum',
  'datenschutz',
  'agb',
  'pressemitteilungen',
  'pressemitteilung',
  'aktuelles',
  'archiv',
  'übersicht',
  'suche',
  'menü',
  'navigation',
]);

interface JsonLdArticle {
  '@type'?: string | string[];
  headline?: string;
  name?: string;
  description?: string;
  url?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string | { url?: string } | Array<string | { url?: string }>;
}

export class GenericHtmlAdapter extends HtmlScraperAdapter {
  readonly typeIdentifier: string;

  constructor(typeId: string) {
    super();
    this.typeIdentifier = typeId;
  }

  parse($: ReturnType<typeof cheerio.load>, url: string, _source: Source): RawNewsItem[] {
    // 1. JSON-LD bevorzugen
    const fromJsonLd = this.parseJsonLd($, url);
    if (fromJsonLd.length > 0) return fromJsonLd;

    // 2. DOM-Heuristik mit Junk-Filter
    return this.parseDom($, url);
  }

  private parseJsonLd(
    $: ReturnType<typeof cheerio.load>,
    baseUrl: string
  ): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      const articles = collectArticles(parsed);
      for (const article of articles) {
        const url = article.url;
        const title = article.headline ?? article.name;
        if (!url || !title) continue;

        const resolved = this.resolveUrl(url, baseUrl);
        if (seen.has(resolved)) continue;
        seen.add(resolved);

        // parseDate statt new Date(): so gilt auch für JSON-LD die
        // Plausibilitätsprüfung (kein Datum aus der Zukunft, nichts vor 1995).
        const dateStr = article.datePublished ?? article.dateModified;
        const publishedAt = this.parseDate(dateStr) ?? new Date();

        items.push({
          externalId: resolved,
          title: this.cleanText(title),
          summary: article.description ? this.cleanText(article.description) : undefined,
          url: resolved,
          publishedAt,
          imageUrl: extractImageFromLd(article.image),
        });
      }
    });

    return items;
  }

  private parseDom(
    $: ReturnType<typeof cheerio.load>,
    baseUrl: string
  ): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const seen = new Set<string>();
    const baseDomain = safeHostname(baseUrl);

    const selectors = [
      'article',
      '[class*="news-item"]',
      '[class*="post-item"]',
      '[class*="article-item"]',
      '[class*="teaser"]',
      '.news-list > li',
      '.posts > li',
      'article, .post, .entry',
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        // Der Selektor trifft oft nur einen Bestandteil des Items — etwa
        // `.teaser-text`, den Fließtext-Block, während Überschrift und
        // Artikellink daneben liegen. Von dort aus aufsteigen, bis der Block
        // beides enthält; aber nicht über die Item-Grenze hinaus, sonst
        // umfasst er die ganze Liste und liefert für alle Treffer dasselbe.
        const $item = widenToItem($, el, elements);

        const link = pickItemLink($item, $);
        const href = link?.attr('href');
        if (!link || !href) return;

        const resolved = this.resolveUrl(href, baseUrl);
        if (seen.has(resolved)) return;

        // Externe Links überspringen (Domain-Filter)
        if (baseDomain && safeHostname(resolved) !== baseDomain) return;

        const title = this.cleanText(
          $item.find('h1, h2, h3, h4').first().text() || link.text()
        );
        if (!isValidTitle(title)) return;

        seen.add(resolved);

        const publishedAt = this.extractDate($item) ?? new Date();

        const summary = this.cleanText(
          $item.find('p, .summary, .excerpt, .teaser-text, .beschreibung').first().text()
        );

        const img = $item.find('img').first().attr('src');

        items.push({
          externalId: resolved,
          title,
          summary: summary && summary.length > 20 ? summary : undefined,
          url: resolved,
          publishedAt,
          imageUrl: img ? this.resolveUrl(img, baseUrl) : undefined,
        });
      });

      if (items.length > 0) break;
    }

    return items;
  }
}

function collectArticles(value: unknown): JsonLdArticle[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(collectArticles);
  }
  if (typeof value !== 'object') return [];

  const obj = value as Record<string, unknown>;

  // @graph enthält oft Arrays von Objekten
  if (Array.isArray(obj['@graph'])) {
    return collectArticles(obj['@graph']);
  }

  const types = ([] as string[]).concat(
    typeof obj['@type'] === 'string' ? [obj['@type'] as string] : (obj['@type'] as string[]) ?? []
  );
  if (types.some((t) => /Article|NewsArticle|BlogPosting|Posting/i.test(t))) {
    return [obj as JsonLdArticle];
  }

  return [];
}

function extractImageFromLd(image: JsonLdArticle['image']): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0];
    return typeof first === 'string' ? first : first?.url;
  }
  return image.url;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Erweitert einen Treffer auf den Block, der das ganze Item umfasst.
 *
 * Generische Selektoren wie `[class*="teaser"]` treffen häufig nur einen
 * Bestandteil — `.teaser-text` etwa enthält den Fließtext, aber weder
 * Überschrift noch Artikellink; der einzige Link darin heißt „> mehr".
 *
 * Deshalb von dort aufsteigen, solange der Block weder eine Überschrift noch
 * einen Link mit brauchbarem Text enthält. Abbruch, sobald der Vorfahre mehr
 * als einen der ursprünglichen Treffer umfasst: dann ist die Item-Grenze
 * überschritten und der Block wäre die ganze Liste.
 */
function widenToItem(
  $: ReturnType<typeof cheerio.load>,
  el: Parameters<Parameters<cheerio.Cheerio['each']>[0]>[1],
  matched: cheerio.Cheerio
): cheerio.Cheerio {
  let $node = $(el);
  for (let depth = 0; depth < MAX_WIDEN_DEPTH; depth++) {
    if (hasUsableTitle($node, $)) return $node;
    const $parent = $node.parent();
    if ($parent.length === 0) return $node;
    // Item-Grenze: der Vorfahre darf nicht mehrere Treffer umschließen.
    if ($parent.find(matched).length > 1) return $node;
    $node = $parent;
  }
  return $node;
}

function hasUsableTitle($scope: cheerio.Cheerio, $: ReturnType<typeof cheerio.load>): boolean {
  if ($scope.find('h1, h2, h3, h4').first().text().trim().length >= MIN_TITLE_LENGTH) return true;
  return pickItemLink($scope, $) !== null;
}

/**
 * Der Link, der am ehesten auf den Artikel zeigt: der erste mit einem Text,
 * der als Titel taugen könnte. „> mehr" und „weiterlesen" fallen damit raus.
 */
function pickItemLink($scope: cheerio.Cheerio, $: ReturnType<typeof cheerio.load>): cheerio.Cheerio | null {
  let found: cheerio.Cheerio | null = null;
  $scope.find('a[href]').each((_, a) => {
    if (found) return;
    const $a = $(a);
    if ($a.text().replace(/\s+/g, ' ').trim().length >= MIN_TITLE_LENGTH) found = $a;
  });
  return found;
}

function isValidTitle(title: string): boolean {
  if (!title || title.length < MIN_TITLE_LENGTH) return false;
  const lower = title.toLowerCase().trim();
  if (JUNK_TITLES.has(lower)) return false;
  // Zu viele Sonderzeichen / nur Symbole
  const letterCount = (title.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length;
  if (letterCount < title.length * 0.5) return false;
  return true;
}
