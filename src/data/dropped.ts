/**
 * Register der als irrelevant verworfenen Items — `data/dropped.json`.
 *
 * Warum: `knownIds` in `appendItems` wird aus dem überlebenden Bestand
 * gebaut. Was die Klassifizierung wegen Score < MIN_RELEVANCE_THRESHOLD aus
 * `news.json` entfernt, ist dem Dedup danach unbekannt — die Quellseite
 * listet den Beitrag aber weiter. Jeder Lauf las ihn also erneut ein,
 * bewertete ihn erneut per Keyword und löschte ihn erneut.
 *
 * Solange der Gemini-Cache den Titel kennt, kostet das keine Anfrage. Nach
 * `CACHE_RETENTION_DAYS` fliegt der Cache-Eintrag aber raus, während die
 * Quellseite unverändert weiterlistet — danach geht dasselbe, schon einmal
 * verworfene Item wieder an die API. Bei einem Budget von 20 Anfragen pro
 * Tag ist das der teuerste Leerlauf im System.
 *
 * Die Rubrik-Version steht mit im Eintrag: wird der Bewertungsmaßstab
 * geschärft, bekommen alle zuvor verworfenen Items wieder eine Chance,
 * statt auf Dauer ausgesperrt zu bleiben.
 */

import { readJson, writeJson } from './json-store';

const FILE = 'dropped.json';

/**
 * Aufbewahrungsdauer. Großzügig, weil Archivseiten Beiträge jahrelang
 * listen — ein zu kurzer Wert lässt sie wieder durch die Bewertung laufen.
 */
const KEEP_DAYS = 180;

interface DroppedEntry {
  id: string;
  /** Rubrik-Version, unter der das Item verworfen wurde. */
  v: number;
  at: string;
}

/**
 * Die IDs, die unter dem AKTUELLEN Bewertungsmaßstab verworfen wurden.
 * Einträge älterer Rubriken bleiben stehen, zählen aber nicht mehr.
 */
export async function loadDroppedIds(rubricVersion: number): Promise<Set<string>> {
  const entries = await readJson<DroppedEntry[]>(FILE, []);
  return new Set(entries.filter((e) => e.v === rubricVersion).map((e) => e.id));
}

/** Vermerkt verworfene Items und räumt abgelaufene Einträge weg. */
export async function markDropped(ids: string[], rubricVersion: number): Promise<void> {
  if (ids.length === 0) return;

  const entries = await readJson<DroppedEntry[]>(FILE, []);
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const kept = entries.filter((e) => new Date(e.at).getTime() > cutoff);

  const known = new Set(kept.filter((e) => e.v === rubricVersion).map((e) => e.id));
  const at = new Date().toISOString();
  for (const id of ids) {
    if (known.has(id)) continue;
    known.add(id);
    kept.push({ id, v: rubricVersion, at });
  }

  await writeJson(FILE, kept, 'chore(data): verworfene Items vermerkt');
}
