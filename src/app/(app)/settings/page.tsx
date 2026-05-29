import { Settings, Palette } from 'lucide-react';
import { PushSettings } from '@/components/PushSettings';
import { InstallStatus } from '@/components/InstallStatus';
import { SettingsForm } from '@/components/SettingsForm';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { GeminiUsagePanel } from '@/components/GeminiUsagePanel';
import { VersionFooter } from '@/components/VersionFooter';
import Link from 'next/link';
import { ChevronRight, List } from 'lucide-react';
import { db, schema } from '@/db';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [settings] = await db.select().from(schema.appSettings).limit(1);

  if (!settings) {
    return (
      <div className="py-6 px-3">
        <p className="text-sm text-destructive">Settings-Tabelle leer. Bitte Seed laufen lassen.</p>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6 px-3">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-semibold">Einstellungen</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          App
        </h2>
        <InstallStatus />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Erscheinungsbild
          </h2>
        </div>
        <ThemeSwitcher />
        <p className="text-xs text-muted-foreground">
          Bei „System" folgt die App dem Hell-/Dunkel-Modus deines Geräts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Benachrichtigungen
        </h2>
        <PushSettings />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Quellen
        </h2>
        <Link
          href="/settings/sources"
          className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand/10 p-2">
              <List className="w-4 h-4 text-brand" />
            </div>
            <div>
              <p className="font-medium">Quellen verwalten</p>
              <p className="text-xs text-muted-foreground">Aktivieren, hinzufügen, entfernen</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          KI-Klassifizierung
        </h2>
        <GeminiUsagePanel />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Verhalten
        </h2>
        <SettingsForm
          initialSettings={{
            refreshIntervalHours: settings.refreshIntervalHours,
            refreshWindowStart: settings.refreshWindowStart,
            refreshWindowEnd: settings.refreshWindowEnd,
            retentionDays: settings.retentionDays,
            notificationsEnabled: settings.notificationsEnabled,
            lastGlobalRefreshAt: settings.lastGlobalRefreshAt?.toISOString() ?? null,
          }}
        />
      </section>

      <VersionFooter />
    </div>
  );
}
