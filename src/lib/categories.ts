/**
 * Kategorien-Konstanten und Helper.
 *
 * Die App nutzt drei sichtbare Kategorien:
 *  - 'fachlich': Studien, Methoden, Leitlinien, klinische Themen
 *  - 'gesetz':   Heilmittelversorgung, GKV, Rechtsfragen
 *  - 'politik':  Berufsverband-Politik, allgemeine Gesundheitspolitik
 *
 * Daneben existieren in der DB noch alte Enum-Werte ('berufspolitik', 'recht',
 * 'evidenz', 'fortbildung', 'leitlinien', 'allgemein') aus früheren Versionen.
 * Diese sind für rechtliche DB-Validität nötig, werden aber in der UI nicht
 * mehr als eigenständige Tabs gezeigt.
 */

import type { NewsCategory } from '@/db/schema';

/** Die drei aktuellen, im UI sichtbaren Kategorien. */
export const VISIBLE_CATEGORIES = ['fachlich', 'gesetz', 'politik'] as const;
export type VisibleCategory = (typeof VISIBLE_CATEGORIES)[number];

/** Alte Werte aus früheren Versionen — werden noch akzeptiert, aber nicht angezeigt. */
export const LEGACY_CATEGORIES = [
  'berufspolitik',
  'recht',
  'evidenz',
  'fortbildung',
  'leitlinien',
  'allgemein',
] as const;

/** Alle gültigen Kategorien (für Routing-Validierung und API-Zod-Schemas). */
export const ALL_CATEGORIES: readonly NewsCategory[] = [
  ...VISIBLE_CATEGORIES,
  ...LEGACY_CATEGORIES,
];

/** Display-Labels für die drei aktuellen Kategorien. */
export const CATEGORY_LABELS: Record<VisibleCategory, string> = {
  fachlich: 'Fachlich',
  gesetz: 'Gesetz',
  politik: 'Politik',
};

/** True, wenn die Kategorie eine der drei aktuell im UI sichtbaren ist. */
export function isVisibleCategory(value: string): value is VisibleCategory {
  return (VISIBLE_CATEGORIES as readonly string[]).includes(value);
}

/** True, wenn der Wert eine bekannte (sichtbare oder legacy) Kategorie ist. */
export function isKnownCategory(value: string): value is NewsCategory {
  return (ALL_CATEGORIES as readonly string[]).includes(value);
}
