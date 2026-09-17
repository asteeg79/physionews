/**
 * Lesestand — pro Gerät im localStorage.
 *
 * Früher stand `is_read` als Spalte an jedem News-Item in der Datenbank.
 * Seit die Daten als JSON-Dateien im Repo liegen und nur noch von GitHub
 * Actions geschrieben werden, gibt es keinen sinnvollen Ort mehr, um einen
 * Klick des Nutzers serverseitig festzuhalten — ein Commit pro geöffneter
 * Karte wäre unverhältnismäßig, und öffentlich einsehbar obendrein.
 *
 * Der Lesestand ist damit eine Geräte-Eigenschaft: was auf dem iPhone
 * gelesen wurde, ist auf dem Desktop weiterhin ungelesen. Für eine private
 * App mit einer Nutzerin ist das der ehrlichere Kompromiss.
 *
 * Gespeichert werden:
 *  - `ids`            einzeln angetippte Items
 *  - `allReadBefore`  Zeitpunkt von „alle als gelesen"; alles, was davor
 *                     abgerufen wurde, gilt als gelesen
 */

import type { NewsItemWithSource } from '@/data/types';

const STORAGE_KEY = 'physionews-read-state';

/** Obergrenze für einzeln gemerkte IDs, damit der Eintrag nicht wächst. */
const MAX_IDS = 2000;

export interface ReadState {
  ids: string[];
  allReadBefore: string | null;
}

/** Ein News-Item, angereichert um den Lesestand dieses Geräts. */
export type ClientNewsItem = NewsItemWithSource & { isRead: boolean };

export const EMPTY_READ_STATE: ReadState = { ids: [], allReadBefore: null };

/** Liest den Lesestand. Liefert bei SSR oder defektem Eintrag den leeren Stand. */
export function loadReadState(): ReadState {
  if (typeof window === 'undefined') return EMPTY_READ_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_READ_STATE;
    const parsed = JSON.parse(raw) as Partial<ReadState>;
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids : [],
      allReadBefore: parsed.allReadBefore ?? null,
    };
  } catch {
    return EMPTY_READ_STATE;
  }
}

function persist(state: ReadState): ReadState {
  if (typeof window === 'undefined') return state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Privater Modus / volles Kontingent — der Lesestand ist es nicht wert,
    // dafür einen Fehler bis ins UI zu reichen.
  }
  return state;
}

/** Gilt das Item auf diesem Gerät als gelesen? */
export function isItemRead(
  state: ReadState,
  item: { id: string; fetchedAt: Date }
): boolean {
  if (state.ids.includes(item.id)) return true;
  if (!state.allReadBefore) return false;
  return item.fetchedAt.getTime() <= new Date(state.allReadBefore).getTime();
}

/** Markiert ein einzelnes Item als gelesen und liefert den neuen Stand. */
export function markRead(state: ReadState, id: string): ReadState {
  if (state.ids.includes(id)) return state;
  // Neueste vorne — beim Abschneiden fallen die ältesten Einträge weg.
  const ids = [id, ...state.ids].slice(0, MAX_IDS);
  return persist({ ...state, ids });
}

/**
 * Markiert alles bis jetzt als gelesen. Die Einzel-IDs werden dabei
 * verworfen, weil sie der Zeitstempel ohnehin abdeckt.
 */
export function markAllRead(): ReadState {
  return persist({ ids: [], allReadBefore: new Date().toISOString() });
}
