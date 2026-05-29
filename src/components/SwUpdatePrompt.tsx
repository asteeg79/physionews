'use client';

/**
 * SwUpdatePrompt — informiert den User über ein verfügbares SW-Update.
 *
 * Verhalten:
 *  1. Bei Mount und periodisch (alle 60s) wird die Registration auf einen
 *     wartenden Service-Worker geprüft.
 *  2. Sobald ein neuer SW im 'waiting'-State ist, erscheint ein Toast
 *     "Update verfügbar — [Aktualisieren]".
 *  3. Klick auf Aktualisieren postet SKIP_WAITING an den wartenden SW
 *     und lädt nach 'controllerchange' die Seite neu.
 *
 * Vorteil gegenüber skipWaiting:true: kein abruptes UI-Update mitten in
 * der Nutzung, kein Cache-Mismatch.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 60_000;
const BUNDLE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown';

export function SwUpdatePrompt() {
  const toastShown = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let reg: ServiceWorkerRegistration | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const promptForUpdate = (waiting: ServiceWorker | null) => {
      if (toastShown.current) return;
      toastShown.current = true;
      toast.info('Update verfügbar', {
        description: 'Eine neue Version der App ist bereit.',
        duration: Infinity,
        action: {
          label: 'Aktualisieren',
          onClick: () => {
            if (waiting) {
              // Sauberer Weg: SW aktivieren, dann lädt controllerchange-Handler neu
              waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
              // Fallback (z. B. iOS-PWA, wo updatefound nicht gefeuert wurde):
              // einfach hart reloaden — neuer Bundle wird vom Server geholt.
              window.location.reload();
            }
          },
        },
      });
    };

    /**
     * Vergleicht die Server-Version (via /api/version, no-store) mit der
     * im Bundle eingebakenen `NEXT_PUBLIC_APP_VERSION`. Bei Abweichung
     * Toast zeigen — auch wenn der Service-Worker noch keinen `waiting`-
     * State hat (iOS-PWAs verschlucken updatefound-Events gelegentlich).
     */
    const checkVersionMismatch = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const data = (await res.json()) as { version?: string };
        if (data.version && data.version !== BUNDLE_VERSION) {
          promptForUpdate(reg?.waiting ?? null);
        }
      } catch {
        // offline → ignorieren
      }
    };

    const checkForWaiting = async () => {
      if (!reg) return;
      try {
        await reg.update();
      } catch {
        // Update-Check kann offline scheitern — ignorieren
      }
      if (reg.waiting) promptForUpdate(reg.waiting);
      // Zweite Sicherung: Bundle-Version vs. Server-Version
      await checkVersionMismatch();
    };

    // Sofort beim Mount Version checken — falls die App lange offen war
    // und seitdem deployed wurde, sieht der User direkt einen Hinweis.
    void checkVersionMismatch();

    navigator.serviceWorker.ready
      .then((registration) => {
        reg = registration;
        // 1. Falls schon ein waiting-SW da ist
        if (registration.waiting) {
          promptForUpdate(registration.waiting);
        }
        // 2. Reagiere auf späteres updatefound-Event
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              promptForUpdate(installing);
            }
          });
        });
        // 3. Periodisches Polling — fängt Updates, die durch Background-Sync passieren
        intervalId = setInterval(checkForWaiting, POLL_INTERVAL_MS);
      })
      .catch(() => undefined);

    // 4. Wenn der wartende SW aktiviert wird (durch unseren SKIP_WAITING-Post),
    //    lädt der Browser einen 'controllerchange'-Event aus — wir reloaden dann.
    let reloading = false;
    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
