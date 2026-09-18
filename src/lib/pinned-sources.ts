/**
 * Gesetzte Quellen — ihre Beiträge sind immer sichtbar und werden, solange
 * sie neu sind, garantiert in die Top-News aufgenommen und benachrichtigt.
 *
 * Anlass: Die YouTube-Videos von RA Benjamin Alt bewertet die KI mit 4 von
 * 10 und damit unterhalb der Anzeigeschwelle. Ein Videotitel wie „Gefahr
 * beim Hausbesuch" liefert ohne Beschreibungstext zu wenig Anhalt für eine
 * faire Einschätzung, obwohl der Inhalt für eine Praxis unmittelbar
 * relevant ist. Die Einstufung hier ist eine bewusste Entscheidung des
 * Nutzers und überstimmt die KI-Bewertung.
 *
 * Abgrenzung zu highlighted-sources.ts: Hervorgehobene Quellen werden
 * optisch markiert und von der Retention ausgenommen — sie bleiben aber
 * der Relevanzschwelle unterworfen. Gesetzte Quellen umgehen sie.
 *
 * Verwendung:
 *  - data/news.ts        → von der Relevanzschwelle ausgenommen, vorn sortiert
 *  - relevance/top-news.ts → neue Beiträge zusätzlich zur KI-Auswahl gepinnt
 *  - lib/push-sender.ts  → neue Beiträge benachrichtigen ohne Score-Schwelle
 *  - relevance/index.ts  → von der Löschung schwacher Bewertungen ausgenommen
 */

/**
 * Je Eintrag müssen ALLE Teilstrings im Quellnamen vorkommen. Zwei Teile
 * statt eines ganzen Namens, damit weder der Gedankenstrich noch eine
 * spätere Umbenennung die Regel stillschweigend aushebelt.
 */
const PINNED_PATTERNS: readonly (readonly string[])[] = [['benjamin alt', 'youtube']];

/**
 * Wie lange ein Beitrag als neu gilt und damit oben steht. RA Alt
 * veröffentlicht alle ein bis zwei Monate — 14 Tage geben jedem Video eine
 * deutliche Phase in den Top-News, ohne den Platz dauerhaft zu belegen.
 */
export const PINNED_FRESH_DAYS = 14;

const DAY_MS = 86_400_000;

export function isPinnedSourceName(name: string): boolean {
  const lower = name.toLowerCase();
  return PINNED_PATTERNS.some((parts) => parts.every((p) => lower.includes(p)));
}

/**
 * Neu genug, um gepinnt und benachrichtigt zu werden. Keine untere Grenze:
 * ein knapp in der Zukunft datierter Beitrag ist erst recht neu.
 */
export function isPinnedFresh(publishedAt: Date, now: number = Date.now()): boolean {
  return now - publishedAt.getTime() <= PINNED_FRESH_DAYS * DAY_MS;
}

/** IDs der gesetzten Quellen aus einer Quellenliste. */
export function pinnedSourceIds(
  sources: ReadonlyArray<{ id: string; name: string }>
): Set<string> {
  return new Set(sources.filter((s) => isPinnedSourceName(s.name)).map((s) => s.id));
}
