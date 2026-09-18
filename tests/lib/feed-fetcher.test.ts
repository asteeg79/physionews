import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSource } from '../helpers';
import type { Source } from '../../src/data/types';

/**
 * Tests für die Erkennung stiller Quellen.
 *
 * Anlass: `lastSuccessAt` wurde gesetzt, sobald der HTTP-Abruf durchging —
 * unabhängig davon, ob der Adapter etwas geparst hatte. 10 von 26 aktiven
 * Quellen meldeten dadurch Erfolg mit null Beiträgen; eine tote Quelle war
 * von einer stillen nicht zu unterscheiden.
 */

const { state } = vi.hoisted(() => ({
  state: {
    sources: [] as Source[],
    parsed: [] as Array<{ title: string; url: string; publishedAt: Date }>,
    saved: null as Source[] | null,
    /** Zustandsbehaftet, damit der zweite Lauf die Items des ersten kennt. */
    news: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@/data/sources', () => ({
  listSources: async () => state.sources,
  saveSources: async (s: Source[]) => {
    state.saved = s;
  },
}));

vi.mock('@/data/news', () => ({
  loadNews: async () => state.news,
  saveNews: async (items: Array<Record<string, unknown>>) => {
    state.news = items;
  },
}));

vi.mock('@/lib/adapters/registry', () => ({
  getAdapter: () => ({ fetch: async () => state.parsed }),
}));

const { fetchAllSources } = await import('../../src/lib/feed-fetcher');

function artikel(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    title: `Beitrag Nummer ${i} mit ausreichend langem Titel`,
    url: `https://example.test/${i}`,
    publishedAt: new Date('2026-05-20'),
  }));
}

beforeEach(() => {
  state.saved = null;
  state.news = [];
});

describe('fetchAllSources — stille Quellen', () => {
  it('zählt leere Läufe hoch, statt sie als Erfolg zu werten', async () => {
    state.sources = [makeSource({ id: 's1', adapterType: 'rss' })];
    state.parsed = [];

    const { results } = await fetchAllSources();

    expect(results[0].parsedItems).toBe(0);
    expect(results[0].emptyRunsInARow).toBe(1);
    expect(state.saved?.[0].emptyRunsInARow).toBe(1);
    // Der Abruf selbst war fehlerfrei — deshalb kein lastError …
    expect(state.saved?.[0].lastError).toBeNull();
    // … aber der Zähler macht den Zustand sichtbar.
    expect(state.saved?.[0].lastItemCount).toBe(0);
  });

  it('zählt über mehrere leere Läufe weiter', async () => {
    state.sources = [makeSource({ id: 's1', adapterType: 'rss', emptyRunsInARow: 4 })];
    state.parsed = [];

    const { results } = await fetchAllSources();
    expect(results[0].emptyRunsInARow).toBe(5);
  });

  it('setzt den Zähler zurück, sobald wieder etwas geparst wird', async () => {
    state.sources = [makeSource({ id: 's1', adapterType: 'rss', emptyRunsInARow: 7 })];
    state.parsed = artikel(3);

    const { results } = await fetchAllSources();
    expect(results[0].emptyRunsInARow).toBe(0);
    expect(results[0].parsedItems).toBe(3);
  });

  it('wertet bekannte Beiträge nicht als leeren Lauf', async () => {
    // Eine Quelle ohne NEUE Beiträge ist normal — entscheidend ist, ob der
    // Adapter überhaupt etwas geparst hat.
    state.sources = [makeSource({ id: 's1', adapterType: 'rss' })];
    state.parsed = artikel(5);

    const { results } = await fetchAllSources();
    const ersterLauf = results[0].newItems;
    expect(ersterLauf).toBe(5);

    // Zweiter Lauf mit denselben Beiträgen: 0 neue, aber 5 geparste.
    const zweiter = await fetchAllSources();
    expect(zweiter.results[0].newItems).toBe(0);
    expect(zweiter.results[0].parsedItems).toBe(5);
    expect(zweiter.results[0].emptyRunsInARow).toBe(0);
  });

  it('überspringt deaktivierte Quellen', async () => {
    state.sources = [makeSource({ id: 's1', adapterType: 'rss', isEnabled: false })];
    state.parsed = artikel(3);

    const { results } = await fetchAllSources();
    expect(results).toHaveLength(0);
  });
});
