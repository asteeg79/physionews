import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-semibold">Einstellungen</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Einstellungen werden in Phase 5 implementiert.
      </p>
    </div>
  );
}
