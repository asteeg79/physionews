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

export function SwUpdatePrompt() {
  const toastShown = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let reg: ServiceWorkerRegistration | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const promptForUpdate = (waiting: ServiceWorker) => {
      if (toastShown.current) return;
      toastShown.current = true;
      toast.info('Update verfügbar', {
        description: 'Eine neue Version der App ist bereit.',
        duration: Infinity,
        action: {
          label: 'Aktualisieren',
          onClick: () => {
            waiting.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      });
    };

    const checkForWaiting = async () => {
      if (!reg) return;
      try {
        await reg.update();
      } catch {
        // Update-Check kann offline scheitern — ignorieren
      }
      if (reg.waiting) promptForUpdate(reg.waiting);
    };

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
