/**
 * GET /api/version — gibt die aktuell deployte App-Version zurück.
 *
 * Niemals gecacht (Cache-Control: no-store + Vercel-CDN-Cache-Control),
 * damit ein Vergleich „Client-Bundle vs. aktueller Deploy" zuverlässig
 * funktioniert.
 *
 * Wird von `SwUpdatePrompt` periodisch abgefragt: weicht die Version
 * vom im Browser geladenen `NEXT_PUBLIC_APP_VERSION` ab, wird der
 * Update-Toast angezeigt — auch dann, wenn der Service-Worker selbst
 * (noch) keinen `waiting`-State meldet (iOS-Safari hängt da gelegentlich).
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(
    {
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      now: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  );
}
