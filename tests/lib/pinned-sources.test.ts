import { describe, it, expect } from 'vitest';
import {
  isPinnedSourceName,
  isPinnedFresh,
  pinnedSourceIds,
  PINNED_FRESH_DAYS,
} from '../../src/lib/pinned-sources';

/**
 * Gesetzte Quellen — die Regel, die die KI-Bewertung überstimmt.
 *
 * Anlass: RA Alts YouTube-Videos bekommen Score 4 und lagen damit unter der
 * Anzeigeschwelle von 7. Vier von fünf Videos waren unsichtbar.
 */
const DAY_MS = 86_400_000;

describe('Gesetzte Quellen', () => {
  it('erkennt RA Alts YouTube-Kanal', () => {
    expect(isPinnedSourceName('RA Benjamin Alt — YouTube')).toBe(true);
  });

  it('greift nicht bei seinen übrigen Quellen', () => {
    // Nur die Videos sind gesetzt — Aktuelles und Artikel werden normal bewertet
    expect(isPinnedSourceName('RA Benjamin Alt — Aktuelles')).toBe(false);
    expect(isPinnedSourceName('RA Benjamin Alt — Artikel')).toBe(false);
  });

  it('greift nicht bei fremden YouTube-Quellen', () => {
    expect(isPinnedSourceName('Physio Meets Science — YouTube')).toBe(false);
  });

  it('bleibt unabhängig von Schreibweise und Trennzeichen', () => {
    // Beide Teilstrings müssen vorkommen, der Gedankenstrich zählt nicht mit
    expect(isPinnedSourceName('ra benjamin alt (youtube)')).toBe(true);
  });

  it('zählt einen Beitrag innerhalb der Frist als neu', () => {
    const now = Date.now();
    expect(isPinnedFresh(new Date(now - 3 * DAY_MS), now)).toBe(true);
    expect(isPinnedFresh(new Date(now - (PINNED_FRESH_DAYS - 1) * DAY_MS), now)).toBe(true);
  });

  it('zählt einen älteren Beitrag nicht mehr als neu', () => {
    const now = Date.now();
    expect(isPinnedFresh(new Date(now - (PINNED_FRESH_DAYS + 1) * DAY_MS), now)).toBe(false);
  });

  it('behandelt ein knapp künftiges Datum als neu', () => {
    // Zeitzonen-Versatz darf ein frisches Video nicht aus der Frist werfen
    const now = Date.now();
    expect(isPinnedFresh(new Date(now + 6 * 3_600_000), now)).toBe(true);
  });

  it('bildet die Quellen-IDs ab', () => {
    const ids = pinnedSourceIds([
      { id: 'yt', name: 'RA Benjamin Alt — YouTube' },
      { id: 'art', name: 'RA Benjamin Alt — Artikel' },
    ]);
    expect([...ids]).toEqual(['yt']);
  });
});
