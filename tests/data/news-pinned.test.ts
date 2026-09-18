import { describe, it, expect, vi } from 'vitest';

/**
 * `queryNews` und gesetzte Quellen (siehe lib/pinned-sources.ts).
 *
 * Anlass: RA Alts YouTube-Videos werden von der KI mit 4 bewertet und lagen
 * damit unter der Anzeigeschwelle von 7 — vier von fünf Videos waren gar
 * nicht sichtbar. Eigene Fixture statt news-query.test.ts, weil eine immer
 * sichtbare Meldung dort jede Filter-Zusicherung verfälschen würde.
 */
const { files } = vi.hoisted(() => {
  const DAY = 86_400_000;
  const sources = [
    { id: 'src-yt', name: 'RA Benjamin Alt — YouTube', category: 'recht', iconName: 'youtube' },
    { id: 'src-a', name: 'IFK Aktuelles', category: 'gesetz', iconName: 'users' },
  ].map((s) => ({
    ...s,
    url: `https://example.test/${s.id}`,
    adapterType: 'rss',
    isEnabled: true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));

  const base = {
    summary: null as string | null,
    imageUrl: null,
    fetchedAt: new Date().toISOString(),
    relevanceMethod: 'ai',
    relevanceReason: null,
    isTopNews: false,
    topics: [] as string[],
    lang: 'de',
  };

  const news = [
    {
      ...base,
      id: 'n-video-neu',
      sourceId: 'src-yt',
      title: 'Gefahr beim Hausbesuch',
      url: 'https://example.test/yt-1',
      publishedAt: new Date(Date.now() - 2 * DAY).toISOString(),
      relevanceScore: 4,
    },
    {
      ...base,
      id: 'n-video-alt',
      sourceId: 'src-yt',
      title: 'Ältere Folge zur Blankoverordnung',
      url: 'https://example.test/yt-2',
      publishedAt: new Date(Date.now() - 200 * DAY).toISOString(),
      relevanceScore: 4,
    },
    {
      ...base,
      id: 'n-stark',
      sourceId: 'src-a',
      title: 'Blankoverordnung startet',
      url: 'https://example.test/1',
      publishedAt: new Date(Date.now() - 1 * DAY).toISOString(),
      relevanceScore: 10,
    },
    {
      ...base,
      id: 'n-schwach',
      sourceId: 'src-a',
      title: 'Randnotiz ohne Praxisbezug',
      url: 'https://example.test/2',
      publishedAt: new Date(Date.now() - 1 * DAY).toISOString(),
      relevanceScore: 4,
    },
  ];

  return { files: { 'sources.json': sources, 'news.json': news } as Record<string, unknown> };
});

vi.mock('@/data/json-store', () => ({
  readJson: async <T,>(fileName: string, fallback: T) =>
    (files[fileName] as T | undefined) ?? fallback,
  writeJson: async () => undefined,
  clearCache: () => undefined,
  toDate: (v: string | null | undefined) => (v ? new Date(v) : null),
  toRequiredDate: (v: string | null | undefined) => (v ? new Date(v) : new Date(0)),
}));

const { queryNews } = await import('../../src/data/news');

describe('queryNews — gesetzte Quellen', () => {
  it('zeigt Videos trotz Score unter der Schwelle', async () => {
    const ids = (await queryNews({ minRelevance: 7 })).map((i) => i.id);
    expect(ids).toContain('n-video-neu');
    expect(ids).toContain('n-video-alt');
  });

  it('lässt andere Quellen weiter an der Schwelle scheitern', async () => {
    // Gleicher Score 4, aber keine gesetzte Quelle
    const ids = (await queryNews({ minRelevance: 7 })).map((i) => i.id);
    expect(ids).not.toContain('n-schwach');
  });

  it('stellt das neue Video vor die stärker bewertete Meldung', async () => {
    const items = await queryNews({ minRelevance: 7 });
    expect(items[0].id).toBe('n-video-neu');
  });

  it('sortiert ein Video nach Ablauf der Frist wieder normal ein', async () => {
    const items = await queryNews({ minRelevance: 7 });
    const alt = items.findIndex((i) => i.id === 'n-video-alt');
    const stark = items.findIndex((i) => i.id === 'n-stark');
    // Score 4 gegen Score 10 — ohne Frist-Bonus steht es hinten
    expect(alt).toBeGreaterThan(stark);
  });
});
