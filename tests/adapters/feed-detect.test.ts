import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectFeed } from '../../src/lib/feed-detect';

const RSS_BODY = '<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>';
const HTML_WITH_FEED = `<!DOCTYPE html>
<html><head>
  <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Mein Feed">
</head><body></body></html>`;
const HTML_WITHOUT_FEED = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hi</h1></body></html>';

describe('detectFeed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('erkennt direkten RSS-Feed', async () => {
    global.fetch = vi.fn(async () =>
      new Response(RSS_BODY, {
        status: 200,
        headers: { 'content-type': 'application/rss+xml' },
      })
    ) as unknown as typeof fetch;

    const result = await detectFeed('https://example.com/feed');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('rss');
  });

  it('findet <link rel="alternate"> im HTML', async () => {
    global.fetch = vi.fn(async () => {
      const res = new Response(HTML_WITH_FEED, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
      Object.defineProperty(res, 'url', { value: 'https://example.com/' });
      return res;
    }) as unknown as typeof fetch;

    const result = await detectFeed('https://example.com/');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://example.com/feed.xml');
    expect(result!.title).toBe('Mein Feed');
  });

  it('liefert null wenn weder Feed noch <link> vorhanden', async () => {
    global.fetch = vi.fn(async () =>
      new Response(HTML_WITHOUT_FEED, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    ) as unknown as typeof fetch;

    const result = await detectFeed('https://example.com/');
    expect(result).toBeNull();
  });

  it('liefert null bei HTTP-Fehler', async () => {
    global.fetch = vi.fn(async () =>
      new Response('Server Error', { status: 500 })
    ) as unknown as typeof fetch;

    const result = await detectFeed('https://example.com/');
    expect(result).toBeNull();
  });
});
