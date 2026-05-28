import { describe, it, expect } from 'vitest';
import { computeItemId } from '../src/lib/dedup';

describe('computeItemId', () => {
  it('gibt für gleiche Eingaben dieselbe ID zurück', () => {
    const id1 = computeItemId('source-1', 'https://example.com/artikel/1', 'Titel des Artikels');
    const id2 = computeItemId('source-1', 'https://example.com/artikel/1', 'Titel des Artikels');
    expect(id1).toBe(id2);
  });

  it('gibt für unterschiedliche URLs verschiedene IDs zurück', () => {
    const id1 = computeItemId('source-1', 'https://example.com/artikel/1', 'Gleicher Titel');
    const id2 = computeItemId('source-1', 'https://example.com/artikel/2', 'Gleicher Titel');
    expect(id1).not.toBe(id2);
  });

  it('normalisiert UTM-Parameter weg', () => {
    const id1 = computeItemId('source-1', 'https://example.com/artikel?utm_source=newsletter', 'Titel');
    const id2 = computeItemId('source-1', 'https://example.com/artikel', 'Titel');
    expect(id1).toBe(id2);
  });

  it('normalisiert Groß-/Kleinschreibung im Titel', () => {
    const id1 = computeItemId('source-1', 'https://example.com/artikel', 'TITEL DES ARTIKELS');
    const id2 = computeItemId('source-1', 'https://example.com/artikel', 'titel des artikels');
    expect(id1).toBe(id2);
  });

  it('gibt einen SHA256-Hex-String zurück (64 Zeichen)', () => {
    const id = computeItemId('source-1', 'https://example.com', 'Titel');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });
});
