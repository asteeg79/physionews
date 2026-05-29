/**
 * Sprach-Heuristik — schnelle Klassifizierung Text → 'de' / 'en' / 'other'.
 *
 * Bewusst KEIN externer Language-Detection-Service (`franc`, `langdetect` etc.) —
 * für unsere Filter-Aufgabe reicht eine simple Heuristik:
 *  - Umlaute oder ß → fast sicher Deutsch
 *  - Deutsche Funktionswörter (der, die, das, und, oder, …) → Deutsch
 *  - Sonst typisch englische Marker → Englisch
 *
 * Edge-Cases:
 *  - „Knie-TEP: Verbessert ein Krafttraining …" hat keine Umlaute → Funktionswörter retten
 *  - „Manuelle Therapie bei Nackenschmerzen — RCT" (RCT ist ein Akronym, kein Hinweis auf EN)
 *  - „PSA-Screening senkt …" — Deutsch trotz englischer Abkürzung
 *
 * Liefert 'unknown' bei sehr kurzen Texten (< 20 Zeichen), die nicht
 * verlässlich klassifiziert werden können — diese werden NICHT gefiltert.
 */

export type DetectedLanguage = 'de' | 'en' | 'unknown';

/**
 * Häufige deutsche Funktionswörter, die in fast jedem deutschen Satz vorkommen.
 * Whole-word-Match, case-insensitive.
 */
const GERMAN_MARKERS = [
  'der', 'die', 'das', 'den', 'dem', 'des',
  'und', 'oder', 'aber', 'sondern',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden',
  'mit', 'von', 'zu', 'zur', 'zum', 'bei', 'auf', 'in', 'im', 'an',
  'für', 'gegen', 'nicht', 'auch', 'noch',
  'eine', 'einer', 'einem', 'einen',
  'sich', 'man', 'sie', 'ihn', 'ihm',
];

/**
 * Häufige englische Funktionswörter.
 * Wichtig: "the", "of", "in", "to" tauchen praktisch in jedem englischen Satz auf.
 */
const ENGLISH_MARKERS = [
  'the', 'a', 'an', 'and', 'or', 'but',
  'in', 'on', 'at', 'to', 'of', 'by', 'with', 'from', 'into', 'onto',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'this', 'that', 'these', 'those', 'which',
  'have', 'has', 'had',
  'for', 'about', 'after', 'before',
  'using', 'used',
  'their', 'they', 'them',
  'effect', 'effects', 'effectiveness',
  'study', 'studies',
];

const GERMAN_SET = new Set(GERMAN_MARKERS);
const ENGLISH_SET = new Set(ENGLISH_MARKERS);

export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length < 20) return 'unknown';

  // 1. Umlaute oder ß → sehr starkes Deutsch-Signal
  if (/[äöüÄÖÜß]/.test(text)) return 'de';

  // 2. Word-Tokens extrahieren und gegen Marker prüfen
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  let germanHits = 0;
  let englishHits = 0;
  for (const t of tokens) {
    if (GERMAN_SET.has(t)) germanHits++;
    if (ENGLISH_SET.has(t)) englishHits++;
  }

  // Klare Mehrheit auf einer Seite
  if (germanHits >= 2 && englishHits === 0) return 'de';
  if (englishHits >= 2 && germanHits === 0) return 'en';
  if (germanHits > englishHits + 1) return 'de';
  if (englishHits > germanHits + 1) return 'en';

  // Bei sehr typisch englischen Kompositionen (mehrere ENG-only-Adjektive)
  // klassifizieren wir auch bei einem einzelnen Marker als en.
  if (englishHits >= 1 && germanHits === 0 && hasEnglishCharSignature(text)) return 'en';

  return 'unknown';
}

/**
 * Heuristik für typische englische Wortendungen, die im Deutschen selten sind.
 * Beispiele: -tion + -ing/-ed/-ical Kombination.
 */
function hasEnglishCharSignature(text: string): boolean {
  const lower = text.toLowerCase();
  let signals = 0;
  if (/\b\w+ing\b/.test(lower)) signals++;
  if (/\b\w+ical\b/.test(lower)) signals++;
  if (/\b\w+ness\b/.test(lower)) signals++;
  if (/\b\w+ies\b/.test(lower)) signals++; // approaches, studies (mit -es)
  if (/\b\w+(ed|al)\b/.test(lower)) signals++;
  return signals >= 2;
}
