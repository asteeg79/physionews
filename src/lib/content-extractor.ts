/**
 * Content-Extractor — holt die HTML-Seite einer News-URL und extrahiert
 * einen Vorschautext.
 *
 * Wird vom GET /api/news/[id]/preview Endpoint genutzt, der beim Aufklappen
 * einer NewsCard im Frontend aufgerufen wird. Das Ergebnis wird im
 * news_items.summary-Feld gecached, sodass nächste Klicks instant antworten.
 *
 * Extraktionsstrategie (priorisiert nach Praxiserfahrung):
 *  1. Article/Main/Entry-Content-Container → längste &lt;p&gt;-Sequenz
 *  2. JSON-LD: NewsArticle.articleBody / description
 *  3. og:description / twitter:description / meta-description als Fallback
 *  4. Body-weite &lt;p&gt;-Sammlung (nachdem Nav/Footer/Aside entfernt wurden)
 *
 * Edge-Cases:
 *  - Google News URLs werden NICHT gefetcht (JS-Redirect zum Original läuft
 *    nur im Browser, nicht im server-side fetch)
 *  - 10s-Timeout pro Fetch — schützt vor hängenden Verbindungen
 *  - 800c-Cap mit sauberem Satz-/Wort-Schnitt
 */
import * as cheerio from 'cheerio';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
};

const MAX_LENGTH = 800;

/**
 * Holt die HTML-Seite und extrahiert einen Vorschautext.
 *
 * Strategie (priorisiert aus Erfahrung):
 *  1. Article/Main/Entry-Content-Container → längste <p>-Sequenz (echte Artikel-Anfang)
 *  2. JSON-LD: NewsArticle.articleBody / description
 *  3. Meta-Tags (og:description, etc.) als Fallback
 *  4. Body-weite <p>-Sammlung
 *
 * Google News URLs (news.google.com) liefern keinen verwertbaren Inhalt —
 * der JS-Redirect zum Original wird vom Server-fetch nicht ausgeführt. In
 * diesem Fall liefern wir früh null zurück.
 *
 * Liefert null bei HTTP-Fehler oder wenn kein sinnvoller Text gefunden wurde.
 */
export async function extractArticleSummary(url: string): Promise<string | null> {
  // Google News URLs umgehen den fetch-redirect (JS-Redirect)
  if (url.includes('news.google.com')) return null;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  // Navigation/Footer entfernen, damit der Body-Fallback nicht voll Junk ist
  $('nav, footer, aside, .sidebar, [role="navigation"], [role="banner"], .menu, .breadcrumb').remove();

  // 1. Main content area → längste p-Sequenz (echter Artikel)
  const containers = [
    'article',
    'main article',
    'main',
    '[role="main"]',
    '.entry-content',
    '.post-content',
    '.article-content',
    '.content-main',
    '.l-article',
    '.l-article__content',
    '#content',
  ];
  for (const sel of containers) {
    const $container = $(sel).first();
    if ($container.length === 0) continue;
    const text = extractParagraphText($container, $);
    if (text && text.length >= 150) {
      return truncate(text, MAX_LENGTH);
    }
  }

  // 2. JSON-LD
  let jsonLdText: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdText !== null) return;
    try {
      const data = JSON.parse($(el).text());
      const found = findArticleText(data);
      if (found) jsonLdText = found;
    } catch {
      // ignore parse errors
    }
  });
  if (jsonLdText !== null) {
    const text: string = jsonLdText;
    if (text.length >= 100) return truncate(cleanText(text), MAX_LENGTH);
  }

  // 3. Meta-Tags als Fallback
  const metaDescription =
    $('meta[property="og:description"]').attr('content') ??
    $('meta[name="twitter:description"]').attr('content') ??
    $('meta[name="description"]').attr('content');
  // Mindestens 100c, damit wir nicht generische Site-Taglines nehmen
  if (metaDescription && metaDescription.length >= 100) {
    return truncate(cleanText(metaDescription), MAX_LENGTH);
  }

  // 4. Fallback: body-weite <p>-Sammlung
  const bodyText = extractParagraphText($('body'), $);
  if (bodyText && bodyText.length >= 150) {
    return truncate(bodyText, MAX_LENGTH);
  }

  // 5. Letzter Notnagel: kürzere Meta-Description (>=60c)
  if (metaDescription && metaDescription.length >= 60) {
    return truncate(cleanText(metaDescription), MAX_LENGTH);
  }

  return null;
}

type CheerioAPI = ReturnType<typeof cheerio.load>;

function extractParagraphText(
  $container: ReturnType<CheerioAPI>,
  $: CheerioAPI
): string {
  const paragraphs: string[] = [];
  $container.find('p').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length >= 40) paragraphs.push(text);
  });
  return paragraphs.join(' ').trim();
}

interface JsonLdNode {
  '@type'?: string | string[];
  description?: string;
  articleBody?: string;
  abstract?: string;
}

function findArticleText(node: unknown): string | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findArticleText(item);
      if (result) return result;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const obj = node as Record<string, unknown> & JsonLdNode;

  if (Array.isArray(obj['@graph'])) {
    return findArticleText(obj['@graph']);
  }

  const types = ([] as string[]).concat(
    typeof obj['@type'] === 'string' ? [obj['@type'] as string] : (obj['@type'] as string[]) ?? []
  );
  if (types.some((t) => /Article|NewsArticle|BlogPosting/i.test(t))) {
    return obj.description ?? obj.articleBody ?? obj.abstract ?? null;
  }

  return null;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  // An letztem Satz oder Wort kappen
  const cut = text.slice(0, max - 1);
  const lastDot = cut.lastIndexOf('. ');
  if (lastDot > max * 0.5) return cut.slice(0, lastDot + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : max - 1) + '…';
}
