import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E7C7B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
