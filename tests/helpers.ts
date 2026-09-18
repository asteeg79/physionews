import type { Source } from '../src/data/types';

/**
 * Baut eine Quelle für Tests. Nur die Felder angeben, auf die es im
 * jeweiligen Test ankommt — der Rest bekommt unauffällige Vorgaben.
 *
 * Vorher stand dasselbe Objekt-Literal in drei Testdateien; ein neues Feld
 * an `Source` brach alle drei gleichzeitig.
 */
export function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 'test-src',
    name: 'Test',
    url: 'https://example.com/',
    adapterType: 'test',
    category: 'evidenz',
    iconName: null,
    isEnabled: true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastItemCount: null,
    emptyRunsInARow: 0,
    createdAt: new Date(),
    ...overrides,
  };
}
