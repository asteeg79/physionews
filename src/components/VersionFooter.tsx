'use client';

/**
 * VersionFooter — zeigt im Settings am Ende die aktuell laufende
 * Bundle-Version (NEXT_PUBLIC_APP_VERSION, build-time inlined) und
 * vergleicht sie live mit der vom Server gemeldeten Version
 * (`/api/version`).
 *
 * - Stimmen Bundle und Server überein → grüner Punkt, „aktuell".
 * - Weichen sie ab → oranger Hinweis: „Neue Version verfügbar —
 *   App schließen und neu öffnen". So lässt sich von außen verifizieren,
 *   ob ein Deploy tatsächlich beim User angekommen ist.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const BUNDLE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown';

type ServerVersion = {
  version: string;
  sha: string | null;
  ref: string | null;
  now: string;
};

export function VersionFooter() {
  const [server, setServer] = useState<ServerVersion | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/version', { cache: 'no-store' })
      .then((r) => r.json() as Promise<ServerVersion>)
      .then((data) => {
        if (!cancelled) setServer(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = server?.version === BUNDLE_VERSION;

  return (
    <div className="mt-8 pt-6 border-t border-border/50">
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <VersionStatusIcon error={error} loading={server === null} matches={matches} />
          <div className="flex-1 min-w-0">
            <p className="font-mono break-all">
              <span className="text-muted-foreground/70">App:</span> {BUNDLE_VERSION}
            </p>
            {server && (
              <p className="font-mono break-all mt-0.5">
                <span className="text-muted-foreground/70">Server:</span> {server.version}
              </p>
            )}
            {!matches && server !== null && (
              <p className="text-amber-700 dark:text-amber-500 mt-1.5">
                Neue Version verfügbar — App schließen und neu öffnen,
                oder über den Update-Hinweis aktualisieren.
              </p>
            )}
            {matches && (
              <p className="text-emerald-700 dark:text-emerald-500 mt-1.5">
                App ist auf aktuellem Stand.
              </p>
            )}
            {error && (
              <p className="text-destructive mt-1.5">
                Server-Version konnte nicht geprüft werden.
              </p>
            )}
          </div>
        </div>

        {/* Notfall-Button: erzwingt das Leeren aller Caches + SW-Unregister
            und einen harten Reload. Nötig, wenn die PWA aus irgendeinem
            Grund das alte Bundle hartnäckig behält (typisch iOS-PWA). */}
        <button
          type="button"
          onClick={async () => {
            try {
              if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map((n) => caches.delete(n)));
              }
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
              }
            } catch {
              /* ignore */
            }
            const sep = window.location.search ? '&' : '?';
            window.location.replace(
              `${window.location.pathname}${window.location.search}${sep}_pn_upd=${Date.now()}`
            );
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Cache leeren und neu laden
        </button>
      </div>
    </div>
  );
}

/**
 * Statussymbol des Versionsvergleichs: Fehler, noch am Laden, identisch
 * oder abweichend. Als eigene Komponente, damit die Auswahl nicht als
 * vierstufige Ternary-Kette mitten im Layout steht.
 */
function VersionStatusIcon({
  error,
  loading,
  matches,
}: Readonly<{ error: boolean; loading: boolean; matches: boolean }>) {
  const cls = 'w-3.5 h-3.5 shrink-0 mt-0.5';
  if (error) return <AlertCircle className={`${cls} text-destructive`} />;
  if (loading) return <Loader2 className={`${cls} animate-spin`} />;
  if (matches) return <CheckCircle2 className={`${cls} text-emerald-600`} />;
  return <AlertCircle className={`${cls} text-amber-600`} />;
}
