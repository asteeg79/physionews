import { describe, it, expect } from 'vitest';
import { titleHash } from '../../src/lib/relevance/gemini-cache';

describe('titleHash', () => {
  it('liefert deterministisch denselben Hash für identische Titel', () => {
    expect(titleHash('Blankoverordnung kommt')).toBe(titleHash('Blankoverordnung kommt'));
  });

  it('normalisiert Whitespace', () => {
    expect(titleHash('Blanko  verordnung   kommt')).toBe(titleHash('Blanko verordnung kommt'));
  });

  it('ist case-insensitive', () => {
    expect(titleHash('Blankoverordnung kommt')).toBe(titleHash('BLANKOVERORDNUNG KOMMT'));
  });

  it('liefert verschiedene Hashes für verschiedene Titel', () => {
    expect(titleHash('Blankoverordnung')).not.toBe(titleHash('Manuelle Therapie'));
  });

  it('hat eine erwartbare Länge von 32 Zeichen (sha256 truncated)', () => {
    expect(titleHash('Test')).toHaveLength(32);
  });
});
