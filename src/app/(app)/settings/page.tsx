import { Settings } from 'lucide-react';
import { PushSettings } from '@/components/PushSettings';
import { InstallStatus } from '@/components/InstallStatus';
import Link from 'next/link';
import { ChevronRight, List } from 'lucide-react';

export default function SettingsPage() {
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

      <p className="text-xs text-muted-foreground text-center pt-4">
        Phase 5 ergänzt: Auto-Refresh-Intervall, Aufbewahrungsdauer, „Alle als gelesen"
      </p>
    </div>
  );
}
