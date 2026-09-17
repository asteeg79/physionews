'use client';

/**
 * SettingsForm — Formular für die App-Verhalten-Sektion in /settings.
 *
 * Verwaltet:
 *  - Refresh-Intervall (1/2/4 h)
 *  - Aktives Zeitfenster (Stunden-Range, Europe/Berlin)
 *  - Globale Push-Notifications
 *  - Retention-Tage (7/14/30/60/90)
 *  - Aktionen: Jetzt aktualisieren / Alle als gelesen / Cache leeren
 *
 * Pattern: Optimistic UI auf allen Wechseln. Bei Fehler wird der Wert
 * zurückgesetzt und ein Toast gezeigt.
 */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Trash2,
  CheckCheck,
  AlertTriangle,
  Clock,
  Calendar,
  BellRing,
  Filter,
  Layers,
} from 'lucide-react';
import { FieldGroup } from './settings/FieldGroup';
import { Toggle } from './settings/Toggle';
import { ActionButton } from './settings/ActionButton';
import { markAllRead as markAllReadLocally } from '@/lib/read-state';

export interface Settings {
  refreshIntervalHours: number;
  refreshWindowStart: number;
  refreshWindowEnd: number;
  retentionDays: number;
  minRelevance: number;
  maxItemsPerSource: number;
  notificationsEnabled: boolean;
  lastGlobalRefreshAt: string | null;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 Stunde' },
  { value: 2, label: '2 Stunden' },
  { value: 4, label: '4 Stunden' },
];

/**
 * Strenge der Auswahl. Die Zahl ist die Mindest-Relevanz auf der Skala des
 * Bewertungsmaßstabs (siehe lib/relevance/gemini.ts): ab 7 gilt eine Meldung
 * dort als „klar relevant", 4–6 heißt „nur mittelbarer Bezug".
 */
const RELEVANCE_OPTIONS = [
  { value: 5, label: 'Breit' },
  { value: 6, label: 'Locker' },
  { value: 7, label: 'Ausgewogen' },
  { value: 8, label: 'Streng' },
];

const PER_SOURCE_OPTIONS = [
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 8, label: '8' },
  { value: 15, label: '15' },
];

const RETENTION_OPTIONS = [
  { value: 7, label: '1 Woche' },
  { value: 14, label: '2 Wochen' },
  { value: 30, label: '1 Monat' },
  { value: 60, label: '2 Monate' },
  { value: 90, label: '3 Monate' },
];

export function SettingsForm({ initialSettings }: Readonly<{ initialSettings: Settings }>) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);

  /**
   * Sendet ein PATCH an /api/settings. Optimistic Update zuerst, bei Fehler revert.
   */
  const patch = async (changes: Partial<Settings>) => {
    const prev = settings;
    setSettings({ ...settings, ...changes });
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Die Einstellungen werden als Commit ins Repo geschrieben; live sind
      // sie erst nach dem folgenden Deploy.
      toast.success('Gespeichert — in ca. 1 Minute aktiv');
    } catch (err) {
      setSettings(prev);
      toast.error('Speichern fehlgeschlagen');
      console.error(err);
    }
  };

  // -- Aktionen --

  const refreshNow = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/refresh-on-demand', { method: 'POST' });
        const body = (await res.json()) as {
          ok?: boolean;
          dispatched?: boolean;
          reason?: string;
          resetIn?: number;
        };
        if (body.ok) {
          // Der Abruf läuft in GitHub Actions — bis die neuen Beiträge in
          // der App stehen, vergehen Pipeline-Lauf plus Deploy.
          toast.success('Abruf gestartet — die neuen Beiträge erscheinen in wenigen Minuten');
        } else if (body.reason === 'too_recent') toast.info('Wurde gerade erst aktualisiert.');
        else if (body.reason === 'rate_limited')
          toast.info(`Limit erreicht — bitte ${Math.ceil((body.resetIn ?? 0) / 60)} Min warten.`);
        else if (body.reason === 'outside_window') toast.info('Außerhalb des Refresh-Fensters.');
      } catch (err) {
        toast.error('Aktualisierung fehlgeschlagen');
        console.error(err);
      }
    });
  };

  /**
   * „Alle als gelesen" wirkt nur auf diesem Gerät: der Lesestand liegt im
   * localStorage, nicht mehr in den Daten (siehe lib/read-state.ts).
   */
  const markAllRead = () => {
    markAllReadLocally();
    toast.success('Alle Beiträge auf diesem Gerät als gelesen markiert');
    router.refresh();
  };

  // Zwei-Klick-Confirm für die destruktive Cache-Lösch-Aktion
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
      <FieldGroup
        icon={<Clock className="w-4 h-4 text-brand" />}
        title="Aktualisierungs-Intervall"
        description="Wie oft die Quellen gecheckt werden, wenn die App offen ist."
      >
        <ChoiceRow
          options={INTERVAL_OPTIONS}
          value={settings.refreshIntervalHours}
          onChange={(v) => patch({ refreshIntervalHours: v })}
          columns={3}
        />
      </FieldGroup>

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

      <FieldGroup
        icon={<Filter className="w-4 h-4 text-brand" />}
        title="Strenge der Auswahl"
        description="Wie eng der Physio-Bezug sein muss, damit eine Meldung erscheint. Aussortierte Beiträge bleiben gespeichert und über die Suche erreichbar."
      >
        <ChoiceRow
          options={RELEVANCE_OPTIONS}
          value={settings.minRelevance}
          onChange={(v) => patch({ minRelevance: v })}
          columns={4}
        />
      </FieldGroup>

      <FieldGroup
        icon={<Layers className="w-4 h-4 text-brand" />}
        title="Meldungen je Quelle"
        description="Verhindert, dass eine fleißige Quelle die Übersicht beherrscht. Bei Suche und Themen-Filter gilt der Deckel nicht."
      >
        <ChoiceRow
          options={PER_SOURCE_OPTIONS}
          value={settings.maxItemsPerSource}
          onChange={(v) => patch({ maxItemsPerSource: v })}
          columns={4}
        />
      </FieldGroup>

      <FieldGroup
        icon={<Calendar className="w-4 h-4 text-brand" />}
        title="Aufbewahrungsdauer"
        description="Ältere Beiträge werden automatisch gelöscht."
      >
        <ChoiceRow
          options={RETENTION_OPTIONS}
          value={settings.retentionDays}
          onChange={(v) => patch({ retentionDays: v })}
          columns={5}
        />
      </FieldGroup>

      <FieldGroup icon={<RefreshCw className="w-4 h-4 text-brand" />} title="Aktionen">
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
            icon={
              confirmClear ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )
            }
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

/**
 * Choice-Row: kompakte Button-Gruppe für „pick one of N"-Settings.
 */
function ChoiceRow({
  options,
  value,
  onChange,
  columns,
}: Readonly<{
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  columns: number;
}>) {
  const gridClass =
    columns === 5 ? 'grid grid-cols-2 sm:grid-cols-5 gap-2' : `grid grid-cols-${columns} gap-2`;
  return (
    <div className={gridClass}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          type="button"
          className={`py-2 text-sm rounded-lg border ${
            value === opt.value
              ? 'bg-brand text-white border-brand'
              : 'bg-card border-border'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Stunden-Dropdown (00:00 – 24:00).
 */
function HourSelect({
  value,
  min,
  max,
  onChange,
}: Readonly<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}>) {
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
