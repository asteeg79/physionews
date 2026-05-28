import { describe, it, expect } from 'vitest';
import {
  isVisibleCategory,
  isKnownCategory,
  VISIBLE_CATEGORIES,
  CATEGORY_LABELS,
} from '../../src/lib/categories';

describe('categories', () => {
  it('akzeptiert die drei sichtbaren Kategorien', () => {
    expect(isVisibleCategory('fachlich')).toBe(true);
    expect(isVisibleCategory('gesetz')).toBe(true);
    expect(isVisibleCategory('politik')).toBe(true);
  });

  it('lehnt Legacy-Werte als nicht-sichtbar ab', () => {
    expect(isVisibleCategory('berufspolitik')).toBe(false);
    expect(isVisibleCategory('allgemein')).toBe(false);
  });

  it('akzeptiert Legacy als bekannte Kategorie', () => {
    expect(isKnownCategory('berufspolitik')).toBe(true);
    expect(isKnownCategory('fachlich')).toBe(true);
  });

  it('lehnt Unbekanntes ab', () => {
    expect(isKnownCategory('quatsch')).toBe(false);
    expect(isVisibleCategory('xyz')).toBe(false);
  });

  it('hat 3 visible Categories', () => {
    expect(VISIBLE_CATEGORIES).toHaveLength(3);
  });

  it('hat Labels für alle sichtbaren Kategorien', () => {
    for (const cat of VISIBLE_CATEGORIES) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});
