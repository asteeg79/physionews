import type { Source } from '@/db/schema';
import type { RawNewsItem, SourceAdapter } from './types';
import { RssAdapter } from './rss';

const rss = new RssAdapter();

export class YouTubeAdapter implements SourceAdapter {
  readonly typeIdentifier = 'youtube';

  async fetch(source: Source): Promise<RawNewsItem[]> {
    const channelId = await resolveChannelId(source.url);
    if (!channelId) {
      throw new Error(`Konnte keine YouTube-Channel-ID für "${source.url}" ermitteln.`);
    }
    const feedSource: Source = {
      ...source,
      url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    };
    return rss.fetch(feedSource);
  }
}

async function resolveChannelId(url: string): Promise<string | null> {
  // Direkte channel_id in URL: https://www.youtube.com/feeds/videos.xml?channel_id=UCxxx
  const fromFeed = url.match(/channel_id=(UC[\w-]+)/);
  if (fromFeed) return fromFeed[1];

  // Handle-Format: @Username oder /channel/UCxxx oder /user/Username
  const fromChannel = url.match(/\/channel\/(UC[\w-]+)/);
  if (fromChannel) return fromChannel[1];

  // Für @Handle-Format: Seite aufrufen und Channel-ID extrahieren
  // Nur als Fallback — setzt User-Agent, um 403 zu vermeiden
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PhysioNews/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    const match = html.match(/"channelId":"(UC[\w-]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
