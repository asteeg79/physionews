'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { isStandalone, isIosSafari } from '@/lib/pwa-status';

export function InstallStatus() {
  const [status, setStatus] = useState<'installed' | 'browser-ios' | 'browser-other' | 'loading'>(
    'loading'
  );

  useEffect(() => {
    if (isStandalone()) setStatus('installed');
    else if (isIosSafari()) setStatus('browser-ios');
    else setStatus('browser-other');
  }, []);

  if (status === 'loading') {
    return <div className="p-4 bg-card border border-border rounded-xl text-sm text-muted-foreground">Lade…</div>;
  }

  if (status === 'installed') {
    return (
      <div className="p-3 bg-brand/5 border border-brand/30 rounded-xl flex items-start gap-2 text-sm">
        <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Als App installiert</p>
          <p className="text-muted-foreground text-xs">Du nutzt PhysioNews im Standalone-Modus.</p>
        </div>
      </div>
    );
  }

  if (status === 'browser-ios') {
    return (
      <div className="p-3 bg-card border border-border rounded-xl text-sm space-y-2">
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-brand mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Noch nicht installiert</p>
            <p className="text-muted-foreground text-xs">Für Push-Benachrichtigungen auf iOS:</p>
          </div>
        </div>
        <ol className="text-xs ml-6 list-decimal text-muted-foreground">
          <li>In Safari unten auf das Teilen-Symbol tippen</li>
          <li>„Zum Home-Bildschirm" auswählen</li>
          <li>App vom Home-Bildschirm öffnen</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="p-3 bg-card border border-border rounded-xl flex items-start gap-2 text-sm">
      <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Im Browser geöffnet</p>
        <p className="text-muted-foreground text-xs">
          Installiere die App über das Browser-Menü („App installieren") für Push-Benachrichtigungen.
        </p>
      </div>
    </div>
  );
}
