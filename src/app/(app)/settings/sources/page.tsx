import { Rss } from 'lucide-react';

export default function SourcesPage() {
  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Rss className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-semibold">Quellen verwalten</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Quellen-Management wird in Phase 5 implementiert.
      </p>
    </div>
  );
}
