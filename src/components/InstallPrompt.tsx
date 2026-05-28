'use client';

import { useEffect, useState } from 'react';
import { Share, Plus, Smartphone, X, Download } from 'lucide-react';
import { isStandalone, isIosSafari } from '@/lib/pwa-status';

const DISMISS_KEY = 'physionews-install-dismissed-at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 Tage

// Chrome/Edge feuern beforeinstallprompt — Typ ist nicht in lib.dom.d.ts
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPrompt() {
  const [mode, setMode] = useState<'ios' | 'native' | null>(null);
  const [nativeEvent, setNativeEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    if (isIosSafari()) {
      setMode('ios');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setNativeEvent(e as BeforeInstallPromptEvent);
      setMode('native');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallNative = async () => {
    if (!nativeEvent) return;
    await nativeEvent.prompt();
    const choice = await nativeEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setMode(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setMode(null);
  };

  if (!mode) return null;

  if (mode === 'ios') {
    return (
      <div className="mx-3 mt-3 rounded-xl bg-card text-card-foreground border border-border shadow-sm p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-brand/10 p-2 shrink-0">
            <Smartphone className="w-5 h-5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight">PhysioNews installieren</p>
            <p className="text-sm text-muted-foreground mt-1">
              Damit Benachrichtigungen funktionieren, musst du die App zum Home-Bildschirm hinzufügen.
            </p>
            <ol className="text-sm mt-3 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="font-medium text-brand">1.</span>
                <span>Tippe unten auf</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded">
                  <Share className="w-3.5 h-3.5" /> Teilen
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-medium text-brand">2.</span>
                <span>Scrolle und wähle</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded">
                  <Plus className="w-3.5 h-3.5" /> Zum Home-Bildschirm
                </span>
              </li>
              <li className="flex items-center gap-2 ml-5 text-muted-foreground">
                <span>Tippe dann auf „Hinzufügen"</span>
              </li>
            </ol>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Hinweis schließen"
            className="shrink-0 -mr-1 -mt-1 p-1 opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 mt-3 rounded-xl bg-card text-card-foreground border border-border shadow-sm p-4 flex items-start gap-3">
      <div className="rounded-full bg-brand/10 p-2 shrink-0">
        <Download className="w-5 h-5 text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">PhysioNews installieren</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Installiere die App für Offline-Zugriff und Benachrichtigungen.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstallNative}
            className="bg-brand text-white text-sm font-medium px-3 py-1.5 rounded-lg"
          >
            Installieren
          </button>
          <button onClick={handleDismiss} className="text-sm px-3 py-1.5 text-muted-foreground">
            Später
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Hinweis schließen"
        className="shrink-0 -mr-1 -mt-1 p-1 opacity-60 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
