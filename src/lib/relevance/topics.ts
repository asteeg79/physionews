/**
 * Themen-Taxonomie für die News-Items.
 *
 * Geschlossene Liste, damit die AI nicht Tag-Wildwuchs produziert
 * (z.B. "Rückenschmerz" vs. "Rücken" vs. "LWS" — wir vereinheitlichen).
 *
 * Die AI darf pro Item bis zu 3 Tags aus dieser Liste vergeben.
 */

export const TOPIC_TAXONOMY = [
  // Anatomie / Diagnosen — muskuloskelettal
  'Wirbelsäule',
  'Schulter',
  'Knie',
  'Hüfte',
  'Hand & Ellenbogen',
  'Fuß & Sprunggelenk',
  'Rückenschmerz',
  'Osteoporose',
  'Arthrose',

  // Neurologie / Päd / Geriatrie
  'Neurologie',
  'Schlaganfall',
  'Parkinson & MS',
  'Pädiatrie',
  'Geriatrie',
  'Sturzprävention',

  // Methoden
  'Manuelle Therapie',
  'Bewegungstherapie',
  'Lymphdrainage',
  'Atemtherapie',
  'Sportphysiotherapie',
  'Reha',

  // Recht & Berufspolitik
  'Heilmittelversorgung',
  'Blankoverordnung',
  'GKV-Vergütung',
  'Direktzugang',
  'Berufsausbildung',
  'Praxisgründung',

  // Evidenz
  'Leitlinie',
  'Studie',
  'Cochrane-Review',

  // Sonstiges
  'Berufsverband',
  'Veranstaltung',
  'Fortbildung',
] as const;

export type Topic = (typeof TOPIC_TAXONOMY)[number];

const TOPIC_SET = new Set<string>(TOPIC_TAXONOMY);

/** Filtert eine AI-Tag-Liste auf erlaubte Werte. */
export function filterToValidTopics(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((t): t is string => typeof t === 'string' && TOPIC_SET.has(t)).slice(0, 3);
}
