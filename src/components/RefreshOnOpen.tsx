'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const LAST_TRIGGER_KEY = 'physionews-last-refresh-trigger';
const MIN_CLIENT_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten Mindestabstand zwischen Triggern

/**
 * Wenn der User die App öffnet (oder den Tab zurückbringt), prüft diese
 * Komponente leise, ob ein Refresh fällig ist. Der Server entscheidet
 * autoritativ — wir machen nur Client-side throttling, um Spam zu vermeiden.
 */
export function RefreshOnOpen() {
  const router = useRouter();
  const fetching = useRef(false);

  useEffect(() => {
    const trigger = async () => {
      if (fetching.current) return;

      const lastClient = Number(localStorage.getItem(LAST_TRIGGER_KEY) ?? '0');
      if (Date.now() - lastClient < MIN_CLIENT_INTERVAL_MS) return;

      fetching.current = true;
      try {
        const res = await fetch('/api/refresh-on-demand', { method: 'POST' });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          totalNew?: number;
          skipped?: boolean;
        };
        localStorage.setItem(LAST_TRIGGER_KEY, String(Date.now()));

        if (body.ok && (body.totalNew ?? 0) > 0) {
          router.refresh();
        }
      } catch (err) {
        console.warn('[RefreshOnOpen] Fehler:', err);
      } finally {
        fetching.current = false;
      }
    };

    // Beim ersten Mount
    void trigger();

    // Wenn der User zur App zurückkehrt
    const onVisible = () => {
      if (document.visibilityState === 'visible') void trigger();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [router]);

  return null;
}
