import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests für den AI-Top-News-Selektor.
 *
 * Die DB-Schicht wird hier nicht echt aufgerufen — wir mocken sie via
 * vi.mock (vi.hoisted, damit der Mock vor dem Import des Moduls greift).
 * Geprüft wird hauptsächlich der Gemini-Response-Pfad, der Fallback bei
 * fehlendem API-Key und die Sanity-Filter (IDs müssen aus dem Pool stammen).
 */

// Mock-Pool ist bereits nach Score DESC + pubDate DESC sortiert
// (simuliert die DB-Query in fetchCandidatePool)
const mockPool = [
  {
    id: 'item-1',
    title: 'Blankoverordnung kommt im Januar',
    sourceName: 'IFK Aktuelles',
    category: 'gesetz',
    relevanceScore: 10,
    publishedAt: new Date('2026-05-20'),
  },
  {
    id: 'item-4',
    title: 'GKV-Vergütungsanpassung 2026',
    sourceName: 'Physio Deutschland',
    category: 'gesetz',
    relevanceScore: 9,
    publishedAt: new Date('2026-05-22'),
  },
  {
    id: 'item-3',
    title: 'Manuelle Therapie bei Nackenschmerzen — RCT',
    sourceName: 'Thieme physioscience',
    category: 'fachlich',
    relevanceScore: 9,
    publishedAt: new Date('2026-05-18'),
  },
  {
    id: 'item-2',
    title: 'Frohe Ostern vom Verband',
    sourceName: 'IFK Aktuelles',
    category: 'politik',
    relevanceScore: 8,
    publishedAt: new Date('2026-04-01'),
  },
  {
    id: 'item-5',
    title: 'Sponsoring-Partnerschaft mit Lilly',
    sourceName: 'DGSP',
    category: 'fachlich',
    relevanceScore: 6,
    publishedAt: new Date('2026-05-10'),
  },
];

// vi.hoisted erlaubt dynamische Mocks die VOR den Modul-Imports greifen
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(mockPool),
            }),
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    // recordUsage in gemini-quota.ts braucht db.insert(...).values(...).onConflictDoUpdate(...)
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => Promise.resolve(),
      }),
    }),
  },
  schema: {
    newsItems: {
      id: 'mock',
      isTopNews: 'mock',
      relevanceScore: 'mock',
      publishedAt: 'mock',
      sourceId: 'mock',
    },
    sources: {
      name: 'mock',
      category: 'mock',
      id: 'mock',
    },
    geminiUsage: {
      date: 'mock',
      tokensUsed: 'mock',
      requestsMade: 'mock',
      updatedAt: 'mock',
    },
  },
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
