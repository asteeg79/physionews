import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'PhysioNews',
  description: 'Nachrichten für Physiotherapeut:innen — gebündelt und aktuell',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PhysioNews',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0E7C7B' },
    { media: '(prefers-color-scheme: dark)', color: '#0a3a3a' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Kein userScalable:false und kein maximumScale — Accessibility-Anforderung,
  // damit Nutzer:innen bei Bedarf zoomen können.
};

// Inline-Script: setzt .dark-Klasse VOR dem ersten Paint anhand der OS-Präferenz.
// Vermeidet "Flash of Unstyled Content". Reagiert live auf Wechsel (z.B. iOS Auto).
const THEME_SCRIPT = `
  (function() {
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var apply = function(m) { document.documentElement.classList.toggle('dark', m.matches); };
      apply(mq);
      mq.addEventListener('change', apply);
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegistrar />
        {children}
        <Toaster position="top-center" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
