import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isVisibleCategory,
  isKnownCategory,
  VISIBLE_CATEGORIES,
  LEGACY_CATEGORIES,
  CATEGORY_LABELS,
} from '../../src/lib/categories';

describe('categories', () => {
  it('akzeptiert die drei sichtbaren Kategorien', () => {
    expect(isVisibleCategory('berufspolitik')).toBe(true);
    expect(isVisibleCategory('recht')).toBe(true);
    expect(isVisibleCategory('evidenz')).toBe(true);
  });

  it('zeigt abgelöste Werte nicht mehr als Tab', () => {
    expect(isVisibleCategory('fachlich')).toBe(false);
    expect(isVisibleCategory('politik')).toBe(false);
  });

  it('lässt abgelöste Werte als Route weiter zu', () => {
    // Alte Lesezeichen auf /kategorie/{slug} sollen nicht ins Leere laufen
    expect(isKnownCategory('fachlich')).toBe(true);
    expect(isKnownCategory('allgemein')).toBe(true);
  });

  it('lehnt Unbekanntes ab', () => {
    expect(isKnownCategory('quatsch')).toBe(false);
    expect(isVisibleCategory('xyz')).toBe(false);
  });

  it('hält sichtbare und abgelöste Werte überschneidungsfrei', () => {
    const overlap = VISIBLE_CATEGORIES.filter((c) =>
      (LEGACY_CATEGORIES as readonly string[]).includes(c)
    );
    expect(overlap).toEqual([]);
  });

  it('hat Labels für alle sichtbaren Kategorien', () => {
    for (const cat of VISIBLE_CATEGORIES) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

/**
 * Der eigentliche Fehler war nicht im Vokabular, sondern zwischen Vokabular
 * und Daten: Die Tabs filterten auf 'fachlich'/'gesetz'/'politik', während
 * jede Quelle noch die ursprünglichen Werte trug. 22 von 23 Quellen hatten
 * damit keinen Tab, und die reine Vokabular-Prüfung oben blieb trotzdem grün.
 * Diese Tests vergleichen deshalb gegen die echten Quellendateien.
 */
describe('Kategorien decken die Quellen ab', () => {
  const sources = JSON.parse(
    readFileSync(join(__dirname, '../../data/sources.json'), 'utf-8')
  ) as Array<{ name: string; category: string }>;

  it('ordnet jede Quelle einer sichtbaren Kategorie zu', () => {
    const ohneTab = sources
      .filter((s) => !isVisibleCategory(s.category))
      .map((s) => `${s.name} (${s.category})`);
    expect(ohneTab).toEqual([]);
  });

  it('füllt jeden Tab mit mindestens einer Quelle', () => {
    const leer = VISIBLE_CATEGORIES.filter(
      (cat) => !sources.some((s) => s.category === cat)
    );
    expect(leer).toEqual([]);
  });

  it('vergibt im Seed nur sichtbare Kategorien', () => {
    const seed = readFileSync(join(__dirname, '../../scripts/seed.ts'), 'utf-8');
    const verwendet = [...seed.matchAll(/category: '([a-zäöü]+)'/g)].map((m) => m[1]);
    expect(verwendet.length).toBeGreaterThan(0);
    expect([...new Set(verwendet.filter((c) => !isVisibleCategory(c)))]).toEqual([]);
  });
});
