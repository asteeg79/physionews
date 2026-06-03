/**
 * Hervorgehobene Quellen — werden in der UI mit Brand-Akzent und Stern
 * markiert UND von der automatischen Retention ausgenommen.
 *
 * Rationale: Diese Quellen publizieren sporadisch (z. B. RA Alt nur alle
 * 1–2 Monate ein YouTube-Video). Bei einer Standard-Retention von 30 Tagen
 * würden ihre Inhalte sofort wieder verschwinden, sobald sie älter als
 * 30 Tage sind. Da das Volumen klein ist (~4 Quellen × wenige Items pro
 * Monat), kann man die hier dauerhaft sichtbar lassen ohne Storage-Probleme.
 *
 * Verwendung:
 *  - NewsCard.tsx → visuelle Hervorhebung (Stern, Brand-Border)
 *  - cron/maintenance/route.ts + refresh-on-demand → Retention-Exkludierung
 *  - top-news.ts (optional) → leichte Score-Begünstigung
 */

/** Kleinbuchstaben-Substring-Matches gegen den Quell-Namen. */
const HIGHLIGHTED_PATTERNS = [
  'benjamin alt',
  'ra benjamin',
  'physiotherapeuten.de',
  'pt zeitschrift',
];

const HIGHLIGHTED_PREFIXES = ['physio.de'];

export function isHighlightedSourceName(name: string): boolean {
  const lower = name.toLowerCase();
  if (HIGHLIGHTED_PATTERNS.some((p) => lower.includes(p))) return true;
  if (HIGHLIGHTED_PREFIXES.some((p) => lower.startsWith(p))) return true;
  return false;
}
