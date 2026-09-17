import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GenericHtmlAdapter } from '../../src/lib/adapters/html/generic';
import type { Source } from '../../src/data/types';

const jsonLdFixture = readFileSync(join(__dirname, 'fixtures/sample-jsonld.html'), 'utf-8');
const domFixture = readFileSync(join(__dirname, 'fixtures/sample-dom.html'), 'utf-8');

function makeSource(url: string): Source {
  return {
    id: 'test',
    name: 'Test',
    url,
    adapterType: 'html:test',
    category: 'evidenz',
    iconName: null,
    isEnabled: true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date(),
  };
}

describe('GenericHtmlAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('JSON-LD Parsing', () => {
    it('liest NewsArticle und Article aus @graph', async () => {
      global.fetch = vi.fn(async () =>
        new Response(jsonLdFixture, { status: 200, headers: { 'Content-Type': 'text/html' } })
      ) as unknown as typeof fetch;

      const adapter = new GenericHtmlAdapter('html:test');
      const items = await adapter.fetch(makeSource('https://example.com/news'));

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Neue Studie zur Physiotherapie bei Rückenschmerzen');
      expect(items[0].url).toBe('https://example.com/news/studie-rueckenschmerzen');
      expect(items[0].imageUrl).toBe('https://example.com/img/studie.jpg');
      expect(items[0].publishedAt.toISOString()).toContain('2025-01-12');
    });
  });

  describe('DOM-Fallback mit Junk-Filter', () => {
    it('filtert zu kurze Titel, Junk-Wörter und externe Links', async () => {
      global.fetch = vi.fn(async () =>
        new Response(domFixture, { status: 200, headers: { 'Content-Type': 'text/html' } })
      ) as unknown as typeof fetch;

      const adapter = new GenericHtmlAdapter('html:test');
      const items = await adapter.fetch(makeSource('https://example.com/aktuelles/'));

      // Erwartet: nur die 2 echten Artikel
      expect(items).toHaveLength(2);

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Wichtige Neuigkeit zur Berufspolitik der Physiotherapie');
      expect(titles).toContain('Fortbildung: Neue Kurse im Frühjahr verfügbar');
      expect(titles).not.toContain('Kurz');
      expect(titles).not.toContain('Drucken');
      expect(titles.find((t) => t.includes('Externer'))).toBeUndefined();
    });

    it('extrahiert Datum aus time[datetime]', async () => {
      global.fetch = vi.fn(async () =>
        new Response(domFixture, { status: 200 })
      ) as unknown as typeof fetch;

      const adapter = new GenericHtmlAdapter('html:test');
      const items = await adapter.fetch(makeSource('https://example.com/aktuelles/'));
      const article1 = items.find((i) => i.title.includes('Berufspolitik'));
      expect(article1).toBeDefined();
      expect(article1!.publishedAt.toISOString()).toContain('2025-01-14');
    });
  });

  it('wirft bei HTTP-Fehler', async () => {
    global.fetch = vi.fn(async () =>
      new Response('Not Found', { status: 404 })
    ) as unknown as typeof fetch;

    const adapter = new GenericHtmlAdapter('html:test');
    await expect(adapter.fetch(makeSource('https://example.com/missing'))).rejects.toThrow(/HTTP 404/);
  });
});
