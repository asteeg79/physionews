/**
 * Hängt einen Query-String an einen Pfad — ohne `?`, wenn keine Parameter
 * gesetzt sind.
 *
 * Stand vorher als verschachteltes Template-Literal an fünf Stellen
 * (`${pathname}${params.toString() ? `?${params.toString()}` : ''}`) in vier
 * Komponenten. Als Funktion ist es lesbarer und `params.toString()` wird
 * nur einmal ausgewertet.
 */
export function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
