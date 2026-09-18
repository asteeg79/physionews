import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Top-News-Pin für gesetzte Quellen.
 *
 * Ein neues RA-Alt-Video muss oben erscheinen, obwohl sein Score (4) weit
 * unter der Pool-Untergrenze (6) liegt — es taucht im Kandidaten-Pool also
 * gar nicht auf. Der Pin wird deshalb nach der Auswahl aufgelegt, und zwar
 * auf jedem Weg: auch dann, wenn die vorherige Auswahl wiederverwendet wird.
 *
 * Eigene Fixture statt top-news.test.ts, weil ein zusätzlich gepinntes Item
 * dort jede Auswahl-Zusicherung um einen Eintrag verschöbe.
 */
const { mockNews, mockSources, savedNews } = vi.hoisted(() => {
  const D = 86_400_000;
  const sources = [
    { id: 'src-ifk', name: 'IFK Aktuelles', category: 'gesetz' },
    { id: 'src-yt', name: 'RA Benjamin Alt — YouTube', category: 'recht' },
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

  const news = [
    { id: 'item-1', sourceId: 'src-ifk', title: 'Blankoverordnung kommt', relevanceScore: 10, publishedAt: new Date(Date.now() - 1 * D) },
    { id: 'item-2', sourceId: 'src-ifk', title: 'GKV-Vergütungsanpassung', relevanceScore: 9, publishedAt: new Date(Date.now() - 2 * D) },
    { id: 'item-3', sourceId: 'src-ifk', title: 'Heilmittelrichtlinie geändert', relevanceScore: 9, publishedAt: new Date(Date.now() - 3 * D) },
    { id: 'item-4', sourceId: 'src-ifk', title: 'Verbandsmitteilung', relevanceScore: 8, publishedAt: new Date(Date.now() - 4 * D) },
    // Score 4 — unterhalb der Pool-Untergrenze von 6
    { id: 'video-neu', sourceId: 'src-yt', title: 'Gefahr beim Hausbesuch', relevanceScore: 4, publishedAt: new Date(Date.now() - 2 * D) },
    { id: 'video-alt', sourceId: 'src-yt', title: 'Ältere Folge', relevanceScore: 4, publishedAt: new Date(Date.now() - 120 * D) },
  ].map((n) => ({
    ...n,
    summary: null,
    url: `https://example.test/${n.id}`,
    imageUrl: null,
    fetchedAt: new Date(),
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

vi.mock('@/data/sources', () => ({ listSources: async () => mockSources }));

const { files } = vi.hoisted(() => ({ files: new Map<string, unknown>() }));

vi.mock('@/data/json-store', () => ({
  readJson: async <T,>(file: string, fallback: T) =>
    files.has(file) ? (files.get(file) as T) : fallback,
  writeJson: async (file: string, value: unknown) => {
    files.set(file, value);
  },
  toRequiredDate: (v: string | null | undefined) => (v ? new Date(v) : new Date(0)),
  toDate: (v: string | null | undefined) => (v ? new Date(v) : null),
  clearCache: () => undefined,
}));

const { selectAndPersistTopNews } = await import('../../src/lib/relevance/top-news');

/** Die im letzten saveNews-Aufruf als Top-News markierten IDs. */
function persistedTopIds(): string[] {
  const last = savedNews.at(-1) as Array<{ id: string; isTopNews: boolean }>;
  return last.filter((n) => n.isTopNews).map((n) => n.id);
}

beforeEach(() => {
  vi.clearAllMocks();
  files.clear();
  savedNews.length = 0;
  delete process.env.GEMINI_API_KEY;
});

describe('Top-News-Pin für gesetzte Quellen', () => {
  it('nimmt ein neues Video auf, obwohl es nicht im Kandidaten-Pool ist', async () => {
    const res = await selectAndPersistTopNews();
    expect(res.selectedIds).toContain('video-neu');
    expect(persistedTopIds()).toContain('video-neu');
  });

  it('verdrängt die KI-Auswahl nicht, sondern kommt hinzu', async () => {
    const res = await selectAndPersistTopNews();
    // Drei reguläre Top-News plus das gepinnte Video
    expect(res.selectedIds).toHaveLength(4);
    expect(res.selectedIds).toContain('item-1');
  });

  it('lässt ein Video außerhalb der Frist ungepinnt', async () => {
    const res = await selectAndPersistTopNews();
    expect(res.selectedIds).not.toContain('video-alt');
  });

  it('pinnt auch dann, wenn die vorherige Auswahl wiederverwendet wird', async () => {
    await selectAndPersistTopNews();
    savedNews.length = 0;
    // Zweiter Lauf: unveränderter Pool, also greift der Wiederverwendungspfad
    const res = await selectAndPersistTopNews();
    expect(res.selectedIds).toContain('video-neu');
    expect(persistedTopIds()).toContain('video-neu');
  });
});
