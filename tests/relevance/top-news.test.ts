import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests für den KI-Top-News-Selektor.
 *
 * Die Datenschicht wird hier nicht echt angefasst — `@/data/news`,
 * `@/data/sources` und der JSON-Store werden via vi.mock ersetzt
 * (vi.hoisted, damit der Mock vor dem Import des Moduls greift).
 * Geprüft wird der Gemini-Response-Pfad, der Fallback bei fehlendem
 * API-Key und der Sanity-Filter (IDs müssen aus dem Pool stammen).
 */

const { mockNews, mockSources, savedNews } = vi.hoisted(() => {
  const sources = [
    { id: 'src-ifk', name: 'IFK Aktuelles', category: 'gesetz' },
    { id: 'src-zvk', name: 'Physio Deutschland', category: 'gesetz' },
    { id: 'src-thieme', name: 'Thieme physioscience', category: 'fachlich' },
    { id: 'src-dgsp', name: 'DGSP', category: 'fachlich' },
  ].map((s) => ({
    ...s,
    url: `https://example.test/${s.id}`,
    adapterType: 'rss',
    iconName: null,
    isEnabled: true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date('2026-01-01'),
  }));

  // Bereits nach Score DESC + Datum DESC sortiert — so wie der Pool,
  // den buildCandidatePool daraus bildet.
  const news = [
    {
      id: 'item-1',
      sourceId: 'src-ifk',
      title: 'Blankoverordnung kommt im Januar',
      relevanceScore: 10,
      publishedAt: new Date('2026-05-20'),
    },
    {
      id: 'item-4',
      sourceId: 'src-zvk',
      title: 'GKV-Vergütungsanpassung 2026',
      relevanceScore: 9,
      publishedAt: new Date('2026-05-22'),
    },
    {
      id: 'item-3',
      sourceId: 'src-thieme',
      title: 'Manuelle Therapie bei Nackenschmerzen — RCT',
      relevanceScore: 9,
      publishedAt: new Date('2026-05-18'),
    },
    {
      id: 'item-2',
      sourceId: 'src-ifk',
      title: 'Frohe Ostern vom Verband',
      relevanceScore: 8,
      publishedAt: new Date('2026-04-01'),
    },
    {
      id: 'item-5',
      sourceId: 'src-dgsp',
      title: 'Sponsoring-Partnerschaft mit Lilly',
      relevanceScore: 6,
      publishedAt: new Date('2026-05-10'),
    },
  ].map((n) => ({
    ...n,
    summary: null,
    url: `https://example.test/${n.id}`,
    imageUrl: null,
    fetchedAt: new Date('2026-05-23'),
    notifiedAt: null,
    relevanceMethod: 'ai' as const,
    relevanceReason: null,
    isTopNews: false,
    topics: [] as string[],
    lang: 'de',
  }));

  return { mockNews: news, mockSources: sources, savedNews: [] as unknown[] };
});

vi.mock('@/data/news', () => ({
  loadNews: async () => mockNews.map((n) => ({ ...n })),
  saveNews: async (items: unknown) => {
    savedNews.push(items);
  },
}));

vi.mock('@/data/sources', () => ({
  listSources: async () => mockSources,
}));

// recordUsage schreibt sonst wirklich data/gemini-usage.json.
vi.mock('@/data/json-store', () => ({
  readJson: async <T,>(_file: string, fallback: T) => fallback,
  writeJson: async () => undefined,
  toRequiredDate: (value: string | null | undefined) => (value ? new Date(value) : new Date(0)),
  toDate: (value: string | null | undefined) => (value ? new Date(value) : null),
  clearCache: () => undefined,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
});

describe('selectAndPersistTopNews', () => {
  it('fällt auf Score-Top-3 zurück, wenn GEMINI_API_KEY fehlt', async () => {
    const { selectAndPersistTopNews } = await import('../../src/lib/relevance/top-news');
    const result = await selectAndPersistTopNews();
    expect(result.usedAi).toBe(false);
    expect(result.selectedIds).toEqual(['item-1', 'item-4', 'item-3']);
    // Pool-Größe: Items mit Score >= 6
    expect(result.poolSize).toBeGreaterThan(0);
  });

  it('nutzt Gemini-Auswahl bei vorhandenem API-Key', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    // Gemini-Mock: liefert "item-3, item-4, item-1" als Top-3 zurück
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(['item-3', 'item-4', 'item-1']) }],
              },
            },
          ],
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    // Vor dem Test alle vorherigen Module-Caches wegwerfen
    vi.resetModules();
    const { selectAndPersistTopNews } = await import('../../src/lib/relevance/top-news');
    const result = await selectAndPersistTopNews();
    expect(result.usedAi).toBe(true);
    expect(result.selectedIds).toEqual(['item-3', 'item-4', 'item-1']);
  });

  it('filtert ungültige IDs aus der Gemini-Antwort', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(['nonexistent-id', 'item-1', 'item-3']),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    vi.resetModules();
    const { selectAndPersistTopNews } = await import('../../src/lib/relevance/top-news');
    const result = await selectAndPersistTopNews();
    expect(result.selectedIds).not.toContain('nonexistent-id');
    expect(result.selectedIds).toEqual(['item-1', 'item-3']);
  });

  it('fällt auf Score zurück, wenn Gemini-Call fehlschlägt', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = vi.fn(async () => new Response('Server Error', { status: 500 })) as unknown as typeof fetch;

    vi.resetModules();
    const { selectAndPersistTopNews } = await import('../../src/lib/relevance/top-news');
    const result = await selectAndPersistTopNews();
    expect(result.usedAi).toBe(false);
    expect(result.selectedIds.length).toBeGreaterThan(0);
  });
});
