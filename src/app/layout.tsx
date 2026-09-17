import type { Metadata, Viewport } from 'next';
import { Roboto, Roboto_Slab } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { SwUpdatePrompt } from '@/components/SwUpdatePrompt';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-roboto-slab',
  display: 'swap',
});

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
    { media: '(prefers-color-scheme: light)', color: '#75b72d' },
    { media: '(prefers-color-scheme: dark)', color: '#2a3d18' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Kein userScalable:false und kein maximumScale — Accessibility-Anforderung,
  // damit Nutzer:innen bei Bedarf zoomen können.
};

// Inline-Script: setzt .dark-Klasse VOR dem ersten Paint.
// Berücksichtigt user-pref aus localStorage; bei 'system' (Default) folgt es dem OS-Setting.
// Vermeidet "Flash of Unstyled Content" und reagiert live auf OS-Wechsel.
const THEME_SCRIPT = `
  (function() {
    try {
      var KEY = 'physionews-theme';
      var stored = localStorage.getItem(KEY);
      var pref = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var apply = function() {
        var dark = pref === 'dark' || (pref === 'system' && mq.matches);
        document.documentElement.classList.toggle('dark', dark);
      };
      apply();
      mq.addEventListener('change', function() { if (pref === 'system') apply(); });
      // Auf Setting-Änderung in anderen Tabs reagieren
      window.addEventListener('storage', function(e) {
        if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system')) {
          pref = e.newValue; apply();
        }
      });
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`h-full antialiased ${roboto.variable} ${robotoSlab.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegistrar />
        <SwUpdatePrompt />
        {children}
        <Toaster position="top-center" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
