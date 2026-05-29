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
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

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
          {error ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          ) : server === null ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />
          ) : matches ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          )}
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
      </div>
    </div>
  );
}
