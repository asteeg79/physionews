import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, CacheFirst, NetworkFirst, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// Service Worker Scope — läuft nicht im Browser-Kontext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: any;

/**
 * Service Worker — bewusst minimal gehalten.
 *
 * Hintergrund: iOS-PWAs sind notorisch dafür bekannt, alte JS-Bundles aus
 * dem Serwist-Precache zu servieren, selbst nachdem ein neuer SW aktiv ist.
 * Das hat in der Vergangenheit dazu geführt, dass UI-Bugfixes (z.B. der
 * NewsCard-Collapse-Fix) tagelang beim User nicht ankamen, weil der alte
 * NewsCard-Code aus dem Precache geladen wurde.
 *
 * Strategie-Wechsel:
 *  - KEIN Precache mehr für Next.js-Build-Output. Statische Assets
 *    (/_next/static/...) sind ohnehin content-hashed — der Browser-Cache
 *    reicht.
 *  - `skipWaiting: true` + `clientsClaim: true`: neue SW-Version übernimmt
 *    sofort, ohne auf Tab-Schließung zu warten. Das in der App laufende
 *    JS bleibt zwar bis zum nächsten Reload das alte, aber alle FOLGENDEN
 *    HTTP-Requests gehen durch den neuen SW — und der neue SW liefert
 *    KEINE alten Precache-Antworten mehr.
 *  - Navigation (HTML): NetworkFirst mit 2 s Timeout. Bei Offline: /offline.
 *  - Statische Assets (JS/CSS): NetworkFirst mit längerem Timeout. Bei
 *    Offline gibts halt nichts — für eine News-App akzeptabel.
 *  - Bilder: CacheFirst mit 30-Tage-Expiration.
 *
 * Trade-off: Verliert Offline-Lesefähigkeit des bereits geladenen UIs.
 * Gewinnt: garantiert immer aktuelle Version, keine "Phantom-Bundles".
 */
// Serwist verlangt, dass `self.__SW_MANIFEST` im Source vorkommt
// (Build-Time-Check). Wir lesen es daher pro forma, übergeben aber ein
// leeres Array an `precacheEntries` — damit wird de facto nichts
// gecached, und das Build geht trotzdem durch.
const _swManifest = self.__SW_MANIFEST;

const serwist = new Serwist({
  // Absichtlich leer: kein Precache mehr (siehe Kommentar oben).
  precacheEntries: [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }: { request: Request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
  runtimeCaching: [
    {
      // Navigation (HTML): zuerst Netz, kurzer Timeout, sonst /offline.
      matcher: ({ request }: { request: Request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages-v2',
        networkTimeoutSeconds: 2,
      }),
    },
    {
      // Next.js statische Assets — content-hashed URLs, sicher zu cachen.
      // NetworkFirst trotzdem, damit nach Deploy schnell die neue Datei kommt.
      matcher: /\/_next\/static\//,
      handler: new NetworkFirst({
        cacheName: 'next-static-v2',
        networkTimeoutSeconds: 5,
      }),
    },
    {
      // News-API: ImmerNetz versuchen, kurzer Timeout. Bei Offline → kein Cache.
      // (Stale-While-Revalidate war zu aggressiv — User sah veraltete Daten
      //  selbst nach Refresh.)
      matcher: /^https?:\/\/.*\/api\/news/,
      handler: new NetworkFirst({
        cacheName: 'api-news-v2',
        networkTimeoutSeconds: 3,
      }),
    },
    {
      // Bilder OK zum cachen.
      matcher: /\.(?:png|jpg|jpeg|webp|gif|svg|ico)$/,
      handler: new CacheFirst({
        cacheName: 'images-v2',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

/**
 * Beim Activate: alle alten Cache-Storages löschen, die NICHT zu den
 * aktuellen runtimeCaching-Namen gehören. Das räumt Caches aus
 * früheren SW-Versionen weg (z.B. den alten serwist-precache).
 */
self.addEventListener('activate', (event: { waitUntil: (p: Promise<unknown>) => void }) => {
  const KEEP = new Set(['pages-v2', 'next-static-v2', 'api-news-v2', 'images-v2']);
  event.waitUntil(
    (async () => {
      const keys = await self.caches.keys();
      await Promise.all(
        keys
          .filter((k: string) => !KEEP.has(k))
          .map((k: string) => self.caches.delete(k))
      );
    })()
  );
});

self.addEventListener('push', (event: { data?: { json: () => unknown }; waitUntil: (p: Promise<unknown>) => void }) => {
  const data =
    (event.data?.json() as { title?: string; body?: string; url?: string; tag?: string } | undefined) ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'PhysioNews', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
      tag: data.tag ?? `physionews-${Date.now()}`,
    })
  );
});

// Legacy-Message-Handler — SKIP_WAITING wird nicht mehr gebraucht
// (skipWaiting: true im Serwist-Constructor reicht), aber wir behalten
// ihn für Rückwärtskompatibilität mit alten Clients im Feld.
self.addEventListener('message', (event: { data?: { type?: string } }) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event: { notification: { close: () => void; data: { url?: string } }; waitUntil: (p: Promise<unknown>) => void }) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients: Array<{ url: string; focus: () => Promise<unknown> }>) => {
      const existing = clients.find((c) => c.url === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
