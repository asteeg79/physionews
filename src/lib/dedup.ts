/**
 * Dedup — generiert deterministische IDs für News-Items.
 *
 * Format: sha256(sourceId + '|' + normalize(url) + '|' + normalize(title))
 *
 * normalize() entfernt Tracking-Query-Parameter (utm_*, ref) und Trailing-
 * Slash bei URLs; bei Titles wird auf lowercase, single-space, alphanumeric
 * + deutsche Umlaute reduziert.
 *
 * Effekt: Derselbe Artikel von verschiedenen Refresh-Zyklen bekommt denselben
 * Hash → ON CONFLICT DO NOTHING beim Insert verhindert Duplikate, ohne dass
 * eine separate Existenz-Prüfung nötig ist.
 */
import { createHash } from 'crypto';

/** Berechnet die deterministische ID für ein News-Item. */
export function computeItemId(sourceId: string, url: string, title: string): string {
  const normalized = [sourceId, normalizeUrl(url), normalizeTitle(title)].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Entfernt Tracking-Parameter und Trailing-Slash. Bei invaliden URLs
 * Fallback auf trim+lowercase, damit der Hash trotzdem stabil ist.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'ref',
    ];
    trackingParams.forEach((p) => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Normalisiert den Titel auf Kleinbuchstaben, Single-Whitespace und
 * alphanumerische Zeichen (inkl. deutscher Umlaute).
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\säöüß-]/g, '')
    .trim();
}
