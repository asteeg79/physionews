/**
 * Plausibilitätsprüfung für Veröffentlichungsdaten.
 *
 * Lag ursprünglich im HTML-Basisadapter und griff damit nur für einen Teil
 * der Quellen — RSS, Google News, YouTube und der JSON-LD-Pfad des
 * Generic-Adapters ließen ein Datum aus der Zukunft unverändert durch.
 * Genau das war der Fehlerfall, für den die Prüfung geschrieben wurde: ein
 * solches Item sortiert sich vor alles andere und läuft nie aus der
 * Retention.
 *
 * Verbindlich angewandt wird sie deshalb in `appendItems` (lib/feed-fetcher.ts),
 * dem einen Punkt, durch den jedes Item jedes Adapters läuft. Der
 * HTML-Basisadapter benutzt sie zusätzlich beim Suchen — dort entscheidet
 * sie, ob weitergesucht wird oder ein Treffer angenommen ist.
 */

/**
 * Zwei Tage Toleranz nach vorn: Zeitzonen-Versatz und Quellen, die ein
 * Veröffentlichungsdatum vorab setzen, sollen nicht verworfen werden.
 */
const FUTURE_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

/** Vor 1995 gab es die hier abgerufenen Quellen nicht — ein solcher Treffer ist ein Fehlgriff. */
const EARLIEST_PLAUSIBLE_YEAR = 1995;

export function isPlausiblePublishDate(date: Date): boolean {
  const t = date.getTime();
  if (Number.isNaN(t)) return false;
  if (t > Date.now() + FUTURE_TOLERANCE_MS) return false;
  return date.getUTCFullYear() >= EARLIEST_PLAUSIBLE_YEAR;
}
