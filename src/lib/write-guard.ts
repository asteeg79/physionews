/**
 * Fehlerbehandlung für schreibende API-Routen.
 *
 * Auf Vercel ist das Dateisystem read-only — Änderungen des Nutzers gehen
 * als Commit über die GitHub-Contents-API ins Repo (siehe data/github.ts).
 * Fehlt dafür die Konfiguration, soll die Route das klar sagen statt
 * still zu scheitern.
 */

import { GitHubNotConfiguredError } from '@/data/github';
import { PushStoreKeyMissingError } from '@/data/push-subscriptions';

/**
 * Übersetzt Konfigurationsfehler in eine 503-Antwort. Alles andere wird
 * weitergeworfen und landet in Next.js' Standard-Fehlerbehandlung.
 */
export function writeErrorResponse(err: unknown): Response {
  if (err instanceof GitHubNotConfiguredError) {
    return Response.json(
      {
        error: 'Änderungen können nicht gespeichert werden.',
        detail:
          'Die App läuft auf einem read-only Dateisystem und braucht GITHUB_TOKEN und GITHUB_REPO, ' +
          'um die Datei im Repository zu aktualisieren.',
      },
      { status: 503 }
    );
  }
  if (err instanceof PushStoreKeyMissingError) {
    return Response.json(
      {
        error: 'Push-Anmeldung kann nicht gespeichert werden.',
        detail:
          'PUSH_STORE_KEY fehlt. Ohne Schlüssel werden die Subscription-Daten nicht abgelegt, ' +
          'da das Repository öffentlich ist.',
      },
      { status: 503 }
    );
  }
  throw err;
}
