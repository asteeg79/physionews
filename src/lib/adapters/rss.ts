import Parser from 'rss-parser';
import type { Source } from '@/data/types';
import type { RawNewsItem, SourceAdapter } from './types';

type CustomFields = {
  item: ['media:content', 'media:thumbnail', 'content:encoded', 'dc:date', 'updated'];
};

const parser: Parser<unknown, Record<string, unknown>> = new Parser({
  timeout: 15_000,
  headers: {
    'User-Agent': 'PhysioNews/1.0 (+https://github.com/asteeg79/physionews)',
    Accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['content:encoded', 'contentEncoded'],
      ['dc:date', 'dcDate'],
      ['updated', 'updated'],
    ],
  } as unknown as CustomFields,
});

export class RssAdapter implements SourceAdapter {
  readonly typeIdentifier = 'rss';

  async fetch(source: Source): Promise<RawNewsItem[]> {
    const res = await globalThis.fetch(source.url, {
      headers: {
        'User-Agent': 'PhysioNews/1.0 (+https://github.com/asteeg79/physionews)',
        Accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} für ${source.url}`);
    }

    const body = await res.text();
    const feed = await parser.parseString(body);

    return feed.items
      .filter((item) => item.link && item.title)
      .map((item) => ({
        title: stripHtml(item.title!).trim(),
        summary: extractSummary(item),
        url: item.link!,
        publishedAt: extractDate(item),
        imageUrl: extractImage(item),
      }))
      .filter((item) => isValidUrl(item.url));
  }
}

function extractDate(item: Parser.Item & Record<string, unknown>): Date {
  const candidates = [
    item.isoDate,
    item.pubDate,
    item.dcDate as string | undefined,
    item.updated as string | undefined,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function extractSummary(item: Parser.Item & Record<string, unknown>): string | undefined {
  const raw =
    item.contentSnippet ??
    (typeof item.summary === 'string' ? item.summary : undefined) ??
    (typeof item.contentEncoded === 'string' ? item.contentEncoded : undefined) ??
    item.content;
  if (!raw) return undefined;
  const text = stripHtml(raw).trim();
  return text.length > 0 ? truncate(text, 400) : undefined;
}

function extractImage(item: Parser.Item & Record<string, unknown>): string | undefined {
  const enclosure = item['enclosure'] as { url?: string; type?: string } | undefined;
  if (enclosure?.url && (enclosure.type ?? '').startsWith('image/')) {
    return enclosure.url;
  }

  const mediaThumb = item.mediaThumbnail as { $?: { url?: string } } | undefined;
  if (mediaThumb?.$?.url) return mediaThumb.$.url;

  const mediaContent = item.mediaContent as
    | { $?: { url?: string; medium?: string; type?: string } }
    | undefined;
  if (
    mediaContent?.$?.url &&
    (mediaContent.$.medium === 'image' || (mediaContent.$.type ?? '').startsWith('image/'))
  ) {
    return mediaContent.$.url;
  }

  // Fallback: erstes <img src> aus content:encoded
  const html = (item.contentEncoded as string | undefined) ?? (item.content as string | undefined);
  if (html) {
    const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
    if (match) return match[1];
  }
  return undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // `<` bewusst mit ausgeschlossen: eine Folge von `<` kann so nicht von
    // der Zeichenklasse verschluckt werden, jeder Fehlversuch bricht sofort
    // ab. Ein Tag kann ohnehin kein `<` enthalten.
    .replace(/<[^<>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
