import Parser from 'rss-parser';
import type { Source } from '@/db/schema';
import type { RawNewsItem, SourceAdapter } from './types';

const parser = new Parser({
  timeout: 15_000,
  headers: {
    'User-Agent': 'PhysioNews/1.0 (+https://github.com/physionews)',
    Accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
  },
});

export class RssAdapter implements SourceAdapter {
  readonly typeIdentifier = 'rss';

  async fetch(source: Source): Promise<RawNewsItem[]> {
    const feed = await parser.parseURL(source.url);
    return feed.items
      .filter((item) => item.link && item.title)
      .map((item) => ({
        externalId: item.guid ?? item.link!,
        title: item.title!.trim(),
        summary: item.contentSnippet ?? item.summary ?? undefined,
        url: item.link!,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        imageUrl: extractImageFromItem(item),
      }));
  }
}

function extractImageFromItem(item: Parser.Item & Record<string, unknown>): string | undefined {
  const enclosure = item['enclosure'] as { url?: string; type?: string } | undefined;
  if (enclosure?.url && enclosure.type?.startsWith('image/')) {
    return enclosure.url;
  }
  const mediaThumbnail = item['media:thumbnail'] as { $?: { url?: string } } | undefined;
  if (mediaThumbnail?.$?.url) return mediaThumbnail.$.url;
  return undefined;
}
