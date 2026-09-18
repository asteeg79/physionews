/**
 * Register der bereits benachrichtigten Items — `data/notified.json`.
 *
 * Warum eine eigene Datei: Die Zusage „jede Meldung wird höchstens einmal
 * gepusht" hing vorher an einem Feld am Item selbst (`notifiedAt`). Damit
 * hing sie an dessen Lebensdauer — und die Wartung löscht Items laufend:
 * die Retention alles ältere als `retentionDays`, der Deckel
 * HIGHLIGHTED_SOURCE_KEEP alles über den fünf neuesten je hervorgehobener
 * Quelle. Steht ein so gelöschtes Item auf der Quellseite weiterhin, liest
 * es der nächste Lauf erneut ein; `computeItemId` ist deterministisch, also
 * ist es dieselbe ID — nur ohne Markierung. Ergebnis wäre ein Push alle
 * zwei Stunden für dieselbe Meldung.
 *
 * Die IDs überdauern das Item deshalb hier. Sie sind billig: 64 Hex-Zeichen
 * plus Zeitstempel, und nach `KEEP_DAYS` fliegen sie raus — deutlich länger
 * als jede Retention-Einstellung (max. 90 Tage), damit ein wiederkehrendes
 * Item die Sperre nicht überdauert.
 */

import { readJson, writeJson } from './json-store';

const FILE = 'notified.json';

/**
 * Aufbewahrungsdauer der Einträge. Muss deutlich über der höchsten
 * einstellbaren Retention (90 Tage) liegen, sonst könnte ein Item die
 * Sperre überleben und erneut gepusht werden.
 */
const KEEP_DAYS = 365;

interface NotifiedEntry {
  id: string;
  /** Zeitpunkt der Benachrichtigung, ISO-8601. */
  at: string;
}

/** Die IDs aller Items, für die schon einmal eine Push verschickt wurde. */
export async function loadNotifiedIds(): Promise<Set<string>> {
  const entries = await readJson<NotifiedEntry[]>(FILE, []);
  return new Set(entries.map((e) => e.id));
}

/**
 * Vermerkt Items als benachrichtigt und räumt dabei abgelaufene Einträge weg.
 * Bereits vermerkte IDs bleiben mit ihrem ursprünglichen Zeitpunkt stehen.
 */
export async function markNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const entries = await readJson<NotifiedEntry[]>(FILE, []);
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const kept = entries.filter((e) => new Date(e.at).getTime() > cutoff);

  const known = new Set(kept.map((e) => e.id));
  const at = new Date().toISOString();
  for (const id of ids) {
    if (known.has(id)) continue;
    known.add(id);
    kept.push({ id, at });
  }

  await writeJson(FILE, kept, 'chore(data): Push-Register aktualisiert');
}
