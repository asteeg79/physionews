/**
 * Kategorien-Konstanten und Helper.
 *
 * Die App zeigt drei Kategorien als Tabs:
 *  - 'berufspolitik': Verbände, Standespolitik, Versorgung, Kostenträger
 *  - 'recht':         Gesetzgebung, G-BA, Heilmittelrichtlinie, Arbeitsrecht
 *  - 'evidenz':       Studien, Reviews, Leitlinien, klinische Fachthemen
 *
 * Historie: Eine frühere Version hat auf das Vokabular
 * 'fachlich'/'gesetz'/'politik' umgestellt, die Quellen aber nie migriert.
 * Alle Quellen trugen weiter die ursprünglichen Werte — die Tabs filterten
 * damit auf Kategorien, die keine einzige Quelle benutzte, und blieben
 * folgerichtig leer. Statt die Quellen nachzuziehen, gilt jetzt wieder das
 * Vokabular der Daten: es trennt Berufspolitik und Recht sauber, was die
 * Zusammenfassung zu 'gesetz' verwischt hatte.
 *
 * Die abgelösten Werte bleiben gültig, damit alte Lesezeichen auf
 * /kategorie/{slug} weiter funktionieren — sie bekommen nur keinen Tab.
 */

import type { NewsCategory } from '@/data/types';

/** Die drei im UI sichtbaren Kategorien. */
export const VISIBLE_CATEGORIES = ['berufspolitik', 'recht', 'evidenz'] as const;
export type VisibleCategory = (typeof VISIBLE_CATEGORIES)[number];

/** Abgelöste Werte — weiterhin als Route gültig, aber ohne eigenen Tab. */
export const LEGACY_CATEGORIES = [
  'fachlich',
  'gesetz',
  'politik',
  'fortbildung',
  'leitlinien',
  'allgemein',
] as const;

/** Alle gültigen Kategorien (für Routing-Validierung und API-Zod-Schemas). */
export const ALL_CATEGORIES: readonly NewsCategory[] = [
  ...VISIBLE_CATEGORIES,
  ...LEGACY_CATEGORIES,
];

/** Display-Labels für die drei sichtbaren Kategorien. */
export const CATEGORY_LABELS: Record<VisibleCategory, string> = {
  berufspolitik: 'Berufspolitik',
  recht: 'Recht',
  evidenz: 'Evidenz',
};

/** True, wenn die Kategorie eine der drei im UI sichtbaren ist. */
export function isVisibleCategory(value: string): value is VisibleCategory {
  return (VISIBLE_CATEGORIES as readonly string[]).includes(value);
}

/** True, wenn der Wert eine bekannte (sichtbare oder abgelöste) Kategorie ist. */
export function isKnownCategory(value: string): value is NewsCategory {
  return (ALL_CATEGORIES as readonly string[]).includes(value);
}
