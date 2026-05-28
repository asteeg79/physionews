'use client';

import { useEffect } from 'react';

/**
 * Registriert den Service Worker (von @serwist/next generiert: /sw.js)
 * und prüft auf Updates.
 *
 * In Development ist Serwist deaktiviert (next.config.ts → disable: isDev),
 * d.h. /sw.js existiert nicht. Wir versuchen die Registrierung dennoch
 * und ignorieren den Fehler still — ist Standard-Praxis für Dev-Workflow.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // Aktualisierungs-Check beim Mount
        reg.update().catch(() => undefined);
      } catch (err) {
        console.warn('[SW] Registrierung fehlgeschlagen:', err);
      }
    };

    void register();
  }, []);

  return null;
}
