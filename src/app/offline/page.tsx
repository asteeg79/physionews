'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Wird vom Service-Worker als Fallback gerendert, wenn eine Navigations-Anfrage
 * offline ist und auch kein Cache-Hit verfügbar ist.
 *
 * Wichtig: diese Seite wird beim Build precached (durch ihre Statik),
 * deshalb keine Server-Datenbankzugriffe.
 */
export default function OfflinePage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-brand/10 p-5 mb-5">
        <WifiOff className="w-10 h-10 text-brand" />
      </div>
      <h1 className="text-xl font-semibold">Offline</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        Du bist gerade nicht mit dem Internet verbunden. Sobald die Verbindung wieder steht,
        kannst du wie gewohnt fortfahren.
      </p>
      <button
        onClick={() => router.refresh()}
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium"
      >
        <RefreshCw className="w-4 h-4" /> Erneut versuchen
      </button>

      <p className="text-xs text-muted-foreground mt-8">
        Tipp: Bereits geladene Beiträge bleiben in der App-Übersicht sichtbar.
      </p>
    </div>
  );
}
