import { describe, it, expect } from 'vitest';
import { TOPIC_TAXONOMY, filterToValidTopics } from '../../src/lib/relevance/topics';

describe('filterToValidTopics', () => {
  it('akzeptiert gültige Tags aus der Taxonomie', () => {
    const result = filterToValidTopics(['Wirbelsäule', 'Manuelle Therapie']);
    expect(result).toEqual(['Wirbelsäule', 'Manuelle Therapie']);
  });

  it('filtert unbekannte Tags raus (Schutz gegen AI-Wildwuchs)', () => {
    const result = filterToValidTopics(['Wirbelsäule', 'Quatsch', 'Erfundener Tag']);
    expect(result).toEqual(['Wirbelsäule']);
  });

  it('kappt bei maximal 3 Tags', () => {
    const result = filterToValidTopics(['Wirbelsäule', 'Schulter', 'Knie', 'Hüfte', 'Reha']);
    expect(result).toHaveLength(3);
  });

  it('liefert leeres Array bei Nicht-Arrays', () => {
    expect(filterToValidTopics(null)).toEqual([]);
    expect(filterToValidTopics(undefined)).toEqual([]);
    expect(filterToValidTopics('Wirbelsäule')).toEqual([]);
    expect(filterToValidTopics({})).toEqual([]);
  });

  it('ignoriert Nicht-String-Einträge im Array', () => {
    const result = filterToValidTopics(['Wirbelsäule', 42, null, 'Knie']);
    expect(result).toEqual(['Wirbelsäule', 'Knie']);
  });

  it('Taxonomie ist nicht leer und enthält Kernbegriffe', () => {
    expect(TOPIC_TAXONOMY.length).toBeGreaterThan(20);
    expect(TOPIC_TAXONOMY).toContain('Wirbelsäule');
    expect(TOPIC_TAXONOMY).toContain('Manuelle Therapie');
    expect(TOPIC_TAXONOMY).toContain('Heilmittelversorgung');
    expect(TOPIC_TAXONOMY).toContain('Leitlinie');
  });
});
