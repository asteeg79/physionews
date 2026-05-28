import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RssAdapter } from '../../src/lib/adapters/rss';
import type { Source } from '../../src/db/schema';

const fixture = readFileSync(join(__dirname, 'fixtures/sample-rss.xml'), 'utf-8');

const fakeSource: Source = {
  id: 'test-src',
  name: 'Test',
  url: 'https://example.com/feed.xml',
  adapterType: 'rss',
  category: 'evidenz',
  iconName: null,
  isEnabled: true,
  notificationsEnabled: true,
  lastFetchAt: null,
  lastSuccessAt: null,
  lastError: null,
  createdAt: new Date(),
};

describe('RssAdapter', () => {
  beforeEach(() => {
    // rss-parser nutzt intern fetch nicht direkt — wir mocken die parseURL-Antwort via globalem fetch
    global.fetch = vi.fn(async () =>
      new Response(fixture, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parst RSS-Items mit Titel, URL und Datum', async () => {
    const adapter = new RssAdapter();
    const items = await adapter.fetch(fakeSource);

    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].title).toBe('Neue Leitlinie zur Schultertherapie');
    expect(items[0].url).toBe('https://example.com/news/schulter?utm_source=feed');
    expect(items[0].publishedAt.getFullYear()).toBe(2025);
  });

  it('filtert Items ohne Link heraus', async () => {
    const adapter = new RssAdapter();
    const items = await adapter.fetch(fakeSource);
    expect(items.find((i) => i.title === 'Item ohne Link')).toBeUndefined();
  });

  it('extrahiert HTML-Inhalte als reinen Text in summary', async () => {
    const adapter = new RssAdapter();
    const items = await adapter.fetch(fakeSource);
    const item = items[0];
    expect(item.summary).toBeDefined();
    expect(item.summary).not.toContain('<');
    expect(item.summary).not.toContain('&hellip;');
  });

  it('zieht Bild aus media:thumbnail oder enclosure', async () => {
    const adapter = new RssAdapter();
    const items = await adapter.fetch(fakeSource);
    const withImage = items.filter((i) => i.imageUrl);
    expect(withImage.length).toBeGreaterThan(0);
  });

  it('nutzt dc:date als Fallback wenn kein pubDate', async () => {
    const adapter = new RssAdapter();
    const items = await adapter.fetch(fakeSource);
    const lws = items.find((i) => i.title.includes('LWS'));
    expect(lws).toBeDefined();
    expect(lws!.publishedAt.toISOString()).toContain('2025-01-10');
  });
});
