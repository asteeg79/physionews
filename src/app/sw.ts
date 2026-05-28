import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, StaleWhileRevalidate, CacheFirst, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// Service Worker Scope — läuft nicht im Browser-Kontext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /^https?:\/\/.*\/api\/news/,
      handler: new StaleWhileRevalidate({
        cacheName: 'api-news',
        plugins: [new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 })],
      }),
    },
    {
      matcher: /\.(?:png|jpg|jpeg|webp|gif|svg)$/,
      handler: new CacheFirst({
        cacheName: 'images',
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

self.addEventListener('push', (event: { data?: { json: () => unknown }; waitUntil: (p: Promise<unknown>) => void }) => {
  const data = (event.data?.json() as { title?: string; body?: string; url?: string } | undefined) ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'PhysioNews', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
      tag: 'physionews-refresh',
      renotify: true,
    })
  );
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
