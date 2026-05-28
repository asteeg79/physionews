import { describe, it, expect } from 'vitest';
import { getTimeBucket } from '../src/lib/time-bucket';

// Hilfsfunktion: Datum relativ zum "jetzt" erstellen
function hoursAgo(h: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - h * 60 * 60 * 1000);
}
function daysAgo(d: number, from: Date = new Date()): Date {
  return hoursAgo(d * 24, from);
}

describe('getTimeBucket', () => {
  // Fixer Referenzzeitpunkt: Mittwoch 10:00 Uhr Berlin (UTC+2 im Sommer)
  const now = new Date('2025-06-11T08:00:00Z'); // = 10:00 Uhr Berlin

  it('klassifiziert ein Item von heute als "heute"', () => {
    const item = new Date('2025-06-11T06:00:00Z'); // 08:00 Uhr Berlin
    expect(getTimeBucket(item, now)).toBe('heute');
  });

  it('klassifiziert ein Item von gestern als "woche"', () => {
    const item = new Date('2025-06-10T10:00:00Z');
    expect(getTimeBucket(item, now)).toBe('woche');
  });

  it('klassifiziert ein Item von vor 5 Tagen als "woche"', () => {
    expect(getTimeBucket(daysAgo(5, now), now)).toBe('woche');
  });

  it('klassifiziert ein Item von vor 8 Tagen als "monat"', () => {
    expect(getTimeBucket(daysAgo(8, now), now)).toBe('monat');
  });

  it('klassifiziert ein Item von vor 29 Tagen als "monat"', () => {
    expect(getTimeBucket(daysAgo(29, now), now)).toBe('monat');
  });

  it('klassifiziert ein Item von vor 31 Tagen als "aelter"', () => {
    expect(getTimeBucket(daysAgo(31, now), now)).toBe('aelter');
  });

  it('klassifiziert ein Item von Mitternacht (exakt) als "heute"', () => {
    // Mitternacht Berlin am selben Tag = 22:00 UTC Vortag (im Sommer UTC+2)
    const midnight = new Date('2025-06-10T22:00:00Z'); // = 00:00 Berlin 11.06.
    expect(getTimeBucket(midnight, now)).toBe('heute');
  });
});
