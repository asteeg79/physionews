import * as cheerio from 'cheerio';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; PhysioNews/1.0; +https://github.com/asteeg79/physionews)',
  Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,*/*;q=0.8',
};

const FEED_CONTENT_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
];

export interface DetectedFeed {
  url: string;
  type: 'rss' | 'atom' | 'xml';
  title?: string;
}

export async function detectFeed(url: string): Promise<DetectedFeed | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const body = await res.text();

  // 1. Antwort ist direkt ein Feed
  if (FEED_CONTENT_TYPES.some((t) => contentType.includes(t)) || looksLikeFeed(body)) {
    return {
      url: res.url ?? url,
      type: contentType.includes('atom') || /<feed[\s>]/i.test(body) ? 'atom' : 'rss',
      title: extractFeedTitle(body),
    };
  }

  // 2. HTML mit <link rel="alternate" type="application/rss+xml">
  if (contentType.includes('html') || /<html/i.test(body)) {
    const $ = cheerio.load(body);
    const links = $('link[rel="alternate"]')
      .map((_, el) => ({
        href: $(el).attr('href'),
        type: ($(el).attr('type') ?? '').toLowerCase(),
        title: $(el).attr('title'),
      }))
      .get()
      .filter((l) => l.href && FEED_CONTENT_TYPES.some((t) => l.type.includes(t)));

    if (links.length > 0) {
      const best = links[0];
      return {
        url: new URL(best.href!, res.url ?? url).toString(),
        type: best.type.includes('atom') ? 'atom' : 'rss',
        title: best.title,
      };
    }
  }

  return null;
}

function looksLikeFeed(body: string): boolean {
  const start = body.trimStart().slice(0, 500).toLowerCase();
  return (
    start.includes('<rss') ||
    start.includes('<feed') ||
    start.includes('<?xml')
  );
}

function extractFeedTitle(xml: string): string | undefined {
  const match = xml.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!match) return undefined;
  return match[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
}
