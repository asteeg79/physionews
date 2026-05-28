'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { isStandalone, supportsPush, urlBase64ToUint8Array } from '@/lib/pwa-status';

const DISMISS_KEY = 'physionews-push-dismissed-at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 Tage

/**
 * Zeigt einen Banner, der nach Push-Berechtigung fragt.
 * Sichtbarkeit:
 *  - App muss als PWA installiert sein (display-mode standalone)
 *  - Push-API muss verfügbar sein
 *  - Berechtigung darf weder "granted" noch "denied" sein
 *  - User hat den Banner in den letzten 7 Tagen nicht weggeklickt
 */
export function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supportsPush()) return;
    if (!isStandalone()) return;
    if (Notification.permission !== 'default') return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    setVisible(true);
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Benachrichtigungen wurden abgelehnt.');
        setVisible(false);
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
      setVisible(false);
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
      toast.error('Aktivierung fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mx-3 mt-3 rounded-xl bg-brand text-white shadow-md p-4 flex items-start gap-3">
      <div className="rounded-full bg-white/15 p-2 shrink-0">
        <Bell className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">Neue Beiträge bekommen</p>
        <p className="text-sm opacity-90 mt-0.5">
          Aktiviere Push-Benachrichtigungen, um zwischen 06–22 Uhr über neue Quellen-Updates informiert zu werden.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleEnable}
            disabled={busy}
            className="bg-white text-brand text-sm font-medium px-3 py-1.5 rounded-lg disabled:opacity-60"
          >
            {busy ? 'Aktiviere…' : 'Aktivieren'}
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/90 text-sm px-3 py-1.5"
          >
            Später
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Banner schließen"
        className="shrink-0 -mr-1 -mt-1 p-1 opacity-80 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
