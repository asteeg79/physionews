'use client';

/**
 * PushSettings — Push-Notification-Steuerung in /settings.
 *
 * Erkennt 5 Zustände:
 *  - unsupported: Browser kann kein Web Push (z.B. iOS-Safari im Tab)
 *  - needs-pwa:   iOS-Browser, aber App nicht als PWA installiert
 *  - denied:      User hat im Browser explizit blockiert
 *  - default:     Noch nie gefragt — bietet Aktivieren-Button
 *  - granted:     Aktiv — Test-Push und Deaktivieren-Buttons
 */

import { useEffect, useState } from 'react';
import { Bell, BellOff, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { isStandalone, supportsPush, isIos, urlBase64ToUint8Array } from '@/lib/pwa-status';
import { InfoCard } from './settings/InfoCard';

type PushState = 'unsupported' | 'needs-pwa' | 'denied' | 'default' | 'granted';

export function PushSettings() {
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const detect = () => {
      if (!supportsPush()) {
        setState('unsupported');
        return;
      }
      if (isIos() && !isStandalone()) {
        setState('needs-pwa');
        return;
      }
      const perm = Notification.permission;
      if (perm === 'granted') setState('granted');
      else if (perm === 'denied') setState('denied');
      else setState('default');
    };
    detect();
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Erlaubnis verweigert');
        setState(permission as PushState);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
        ),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Benachrichtigungen aktiviert.');
      setState('granted');
    } catch (err) {
      console.error(err);
      toast.error('Aktivierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      toast.success('Benachrichtigungen deaktiviert.');
      // Notification.permission bleibt auf "granted", auch nach Unsubscribe.
      // Aus UX-Sicht zeigen wir den "default"-Zustand, damit der User sie wieder einschalten kann.
      setState('default');
    } catch (err) {
      console.error(err);
      toast.error('Deaktivierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { reason?: string };
        if (body.reason === 'no-subscriptions') {
          toast.error('Keine aktiven Subscriptions gefunden.');
        } else {
          toast.error('Test-Push fehlgeschlagen.');
        }
        return;
      }
      const body = (await res.json()) as { sentTo: number };
      toast.success(`Test-Push an ${body.sentTo} Gerät(e) gesendet.`);
    } catch (err) {
      console.error(err);
      toast.error('Test-Push fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return <div className="p-4 bg-card border border-border rounded-xl text-sm text-muted-foreground">Lade…</div>;
  }

  if (state === 'unsupported') {
    return (
      <InfoCard icon={<AlertCircle className="w-4 h-4" />} variant="muted">
        Dein Browser unterstützt keine Push-Benachrichtigungen.
      </InfoCard>
    );
  }

  if (state === 'needs-pwa') {
    return (
      <InfoCard icon={<AlertCircle className="w-4 h-4" />} variant="muted">
        Push funktioniert auf iOS erst, wenn die App über „Teilen → Zum Home-Bildschirm" installiert ist.
        Ab iOS 16.4 möglich.
      </InfoCard>
    );
  }

  if (state === 'denied') {
    return (
      <InfoCard icon={<BellOff className="w-4 h-4" />} variant="muted">
        Benachrichtigungen wurden vom Browser blockiert. In den Browser-Einstellungen wieder zulassen.
      </InfoCard>
    );
  }

  if (state === 'granted') {
    return (
      <div className="space-y-2">
        <InfoCard icon={<Bell className="w-4 h-4 text-brand" />} variant="success">
          Benachrichtigungen sind aktiv. Du wirst zwischen 06–22 Uhr über neue Beiträge informiert.
        </InfoCard>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-card border border-border rounded-xl text-sm font-medium disabled:opacity-60"
          >
            <Send className="w-4 h-4" /> Test-Push senden
          </button>
          <button
            onClick={handleDisable}
            disabled={busy}
            className="flex items-center justify-center gap-2 p-3 bg-card border border-border rounded-xl text-sm text-destructive disabled:opacity-60"
          >
            <BellOff className="w-4 h-4" /> Deaktivieren
          </button>
        </div>
      </div>
    );
  }

  // default
  return (
    <div className="space-y-2">
      <InfoCard icon={<Bell className="w-4 h-4" />} variant="muted">
        Aktiviere Benachrichtigungen, um bei neuen Beiträgen informiert zu werden.
      </InfoCard>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="w-full p-3 bg-brand text-white font-medium rounded-xl disabled:opacity-60"
      >
        {busy ? 'Aktiviere…' : 'Benachrichtigungen aktivieren'}
      </button>
    </div>
  );
}

// InfoCard wurde in ./settings/InfoCard ausgelagert.
