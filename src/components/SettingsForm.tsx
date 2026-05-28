'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2, CheckCheck, AlertTriangle, Clock, Calendar, BellRing } from 'lucide-react';

interface Settings {
  refreshIntervalHours: number;
  refreshWindowStart: number;
  refreshWindowEnd: number;
  retentionDays: number;
  notificationsEnabled: boolean;
  lastGlobalRefreshAt: string | null;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 Stunde' },
  { value: 2, label: '2 Stunden' },
  { value: 4, label: '4 Stunden' },
];

const RETENTION_OPTIONS = [
  { value: 7, label: '1 Woche' },
  { value: 30, label: '1 Monat' },
  { value: 90, label: '3 Monate' },
  { value: 365, label: '1 Jahr' },
];

export function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);

  const patch = async (changes: Partial<Settings>) => {
    const optimistic = { ...settings, ...changes };
    setSettings(optimistic);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(JSON.stringify(body.error));
      }
      toast.success('Gespeichert');
    } catch (err) {
      setSettings(settings); // revert
      toast.error('Speichern fehlgeschlagen');
      console.error(err);
    }
  };

  const refreshNow = () => {
    startTransition(async () => {
      try {
        // Cron-Endpoint braucht Secret — wir nutzen on-demand
        const res = await fetch('/api/refresh-on-demand', { method: 'POST' });
        const body = (await res.json()) as {
          ok?: boolean;
          totalNew?: number;
          skipped?: boolean;
          reason?: string;
          resetIn?: number;
        };
        if (body.ok) {
          toast.success(`${body.totalNew ?? 0} neue Beiträge geladen`);
          router.refresh();
        } else if (body.reason === 'too_recent') {
          toast.info('Wurde gerade erst aktualisiert.');
        } else if (body.reason === 'rate_limited') {
          toast.info(`Zu viele Anfragen — bitte ${Math.ceil((body.resetIn ?? 0) / 60)} Min warten.`);
        } else if (body.reason === 'outside_window') {
          toast.info('Außerhalb des Refresh-Fensters.');
        }
      } catch (err) {
        toast.error('Aktualisierung fehlgeschlagen');
        console.error(err);
      }
    });
  };

  const markAllRead = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/news/mark-all-read', { method: 'POST' });
        const body = (await res.json()) as { markedAsRead: number };
        toast.success(`${body.markedAsRead} Beiträge markiert`);
        router.refresh();
      } catch (err) {
        toast.error('Aktion fehlgeschlagen');
        console.error(err);
      }
    });
  };

  const clearCache = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/cache/clear', { method: 'POST' });
        const body = (await res.json()) as { deleted: number };
        toast.success(`${body.deleted} Beiträge gelöscht`);
        router.refresh();
        setConfirmClear(false);
      } catch (err) {
        toast.error('Cache-Löschen fehlgeschlagen');
        console.error(err);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Refresh-Intervall */}
      <FieldGroup
        icon={<Clock className="w-4 h-4 text-brand" />}
        title="Aktualisierungs-Intervall"
        description="Wie oft die Quellen gecheckt werden, wenn die App offen ist."
      >
        <div className="flex gap-2">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => patch({ refreshIntervalHours: opt.value })}
              className={`flex-1 py-2 text-sm rounded-lg border ${
                settings.refreshIntervalHours === opt.value
                  ? 'bg-brand text-white border-brand'
                  : 'bg-card border-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      {/* Refresh-Fenster */}
      <FieldGroup
        icon={<Clock className="w-4 h-4 text-brand" />}
        title="Aktive Stunden"
        description="Außerhalb dieses Zeitfensters keine Refreshes und keine Push-Benachrichtigungen."
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Von</span>
          <HourSelect
            value={settings.refreshWindowStart}
            min={0}
            max={settings.refreshWindowEnd - 1}
            onChange={(v) => patch({ refreshWindowStart: v })}
          />
          <span className="text-muted-foreground">bis</span>
          <HourSelect
            value={settings.refreshWindowEnd}
            min={settings.refreshWindowStart + 1}
            max={24}
            onChange={(v) => patch({ refreshWindowEnd: v })}
          />
          <span className="text-muted-foreground">Uhr (Europe/Berlin)</span>
        </div>
      </FieldGroup>

      {/* Push global */}
      <FieldGroup
        icon={<BellRing className="w-4 h-4 text-brand" />}
        title="Benachrichtigungen"
        description="Globale Push-Schalter. Pro Quelle separat einstellbar."
      >
        <Toggle
          enabled={settings.notificationsEnabled}
          onChange={(v) => patch({ notificationsEnabled: v })}
          label={settings.notificationsEnabled ? 'Aktiviert' : 'Deaktiviert'}
        />
      </FieldGroup>

      {/* Aufbewahrungsdauer */}
      <FieldGroup
        icon={<Calendar className="w-4 h-4 text-brand" />}
        title="Aufbewahrungsdauer"
        description="Ältere Beiträge werden automatisch gelöscht."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RETENTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => patch({ retentionDays: opt.value })}
              className={`py-2 text-sm rounded-lg border ${
                settings.retentionDays === opt.value
                  ? 'bg-brand text-white border-brand'
                  : 'bg-card border-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      {/* Aktionen */}
      <FieldGroup
        icon={<RefreshCw className="w-4 h-4 text-brand" />}
        title="Aktionen"
      >
        <div className="space-y-2">
          <ActionButton
            onClick={refreshNow}
            disabled={pending}
            icon={<RefreshCw className="w-4 h-4" />}
            label="Jetzt aktualisieren"
          />
          <ActionButton
            onClick={markAllRead}
            disabled={pending}
            icon={<CheckCheck className="w-4 h-4" />}
            label="Alle als gelesen markieren"
          />
          <ActionButton
            onClick={clearCache}
            disabled={pending}
            icon={confirmClear ? <AlertTriangle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            label={confirmClear ? 'Wirklich? Nochmal tippen' : 'Cache leeren'}
            variant={confirmClear ? 'danger' : 'default'}
          />
        </div>
      </FieldGroup>

      {settings.lastGlobalRefreshAt && (
        <p className="text-xs text-muted-foreground text-center">
          Letzter Refresh: {new Date(settings.lastGlobalRefreshAt).toLocaleString('de-DE')}
        </p>
      )}
    </div>
  );
}

function FieldGroup({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="pt-1">{children}</div>
    </div>
  );
}

function HourSelect({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const options: number[] = [];
  for (let i = min; i <= max; i++) options.push(i);
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-card border border-border rounded-md px-2 py-1 text-sm"
    >
      {options.map((h) => (
        <option key={h} value={h}>
          {h.toString().padStart(2, '0')}:00
        </option>
      ))}
    </select>
  );
}

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center justify-between w-full p-3 bg-card border border-border rounded-xl"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative inline-block w-10 h-6 rounded-full transition-colors ${
          enabled ? 'bg-brand' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  variant = 'default',
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'danger';
}) {
  const cls =
    variant === 'danger'
      ? 'bg-destructive/10 border-destructive/30 text-destructive'
      : 'bg-card border-border';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 w-full p-3 border rounded-xl text-sm disabled:opacity-60 ${cls}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
