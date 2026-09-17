import type { Source } from '@/data/types';
import type { RawNewsItem, SourceAdapter } from './types';
import { RssAdapter } from './rss';

const rss = new RssAdapter();

const YOUTUBE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
  // Setzt EU-Cookie-Consent, damit YouTube nicht auf consent.youtube.com umleitet
  Cookie:
    'CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzc3MjQaAmRlIAEaBgiA_LyaBg',
};

const CHANNEL_ID_PATTERNS = [
  /"externalId":"(UC[A-Za-z0-9_-]+)"/,
  /"channelId":"(UC[A-Za-z0-9_-]+)"/,
  /<meta itemprop="(?:channelId|identifier)" content="(UC[A-Za-z0-9_-]+)"/,
  /youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/,
];

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

export async function resolveChannelId(url: string): Promise<string | null> {
  // Direkte channel_id in URL
  const fromFeed = /channel_id=(UC[\w-]+)/.exec(url);
  if (fromFeed) return fromFeed[1];

  const fromChannel = /\/channel\/(UC[\w-]+)/.exec(url);
  if (fromChannel) return fromChannel[1];

  // @Handle oder /user/ — Seite abrufen und Channel-ID extrahieren
  try {
    const res = await fetch(url, {
      headers: YOUTUBE_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    for (const pattern of CHANNEL_ID_PATTERNS) {
      const match = pattern.exec(html);
      if (match) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}
