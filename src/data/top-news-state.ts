/**
 * Merkt sich, für welchen Kandidaten-Pool die letzte Top-News-Auswahl galt
 * — `data/top-news.json`.
 *
 * Warum: Die KI-Auswahl lief bei jedem Pipeline-Lauf, also bis zu neunmal
 * täglich. Gemessen an der Projekt-Historie kostet sie genau eine Anfrage
 * pro Lauf — bei einem Free-Tier-Budget von 20 Anfragen pro Tag also rund
 * die Hälfte. Und sie lieferte nachweislich oft dasselbe Ergebnis: die
 * Läufe um 08:58 und 11:51 wählten dieselben drei Titel, ebenso 14:30 und
 * 18:29.
 *
 * Gleichzeitig blieben Items unbewertet auf `pending` liegen, weil das
 * Budget aufgebraucht war — die redundanten Auswahl-Anfragen kosteten also
 * unmittelbar sichtbare Inhalte.
 *
 * Mit der Signatur des Pools wird die Anfrage übersprungen, solange sich an
 * den Kandidaten nichts geändert hat.
 */

import { createHash } from 'node:crypto';
import { readJson, writeJson } from './json-store';

const FILE = 'top-news.json';

interface TopNewsState {
  /** Signatur des Kandidaten-Pools, für den `selectedIds` gilt. */
  signature: string;
  selectedIds: string[];
  at: string;
}

/**
 * Signatur über den Kandidaten-Pool: IDs und Scores in ihrer Reihenfolge.
 *
 * Bewusst auch die Scores — eine Neubewertung kann die Rangfolge ändern,
 * ohne dass ein Item hinzukommt oder wegfällt.
 */
export function poolSignature(pool: ReadonlyArray<{ id: string; relevanceScore: number }>): string {
  const input = pool.map((p) => `${p.id}:${p.relevanceScore}`).join('|');
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

export async function loadTopNewsState(): Promise<TopNewsState | null> {
  return readJson<TopNewsState | null>(FILE, null);
}

export async function saveTopNewsState(signature: string, selectedIds: string[]): Promise<void> {
  await writeJson<TopNewsState>(
    FILE,
    { signature, selectedIds, at: new Date().toISOString() },
    'chore(data): Top-News-Auswahl vermerkt'
  );
}
