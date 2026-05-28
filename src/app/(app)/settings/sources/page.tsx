import { Rss, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { db, schema } from '@/db';
import { asc } from 'drizzle-orm';
import { SourcesManager } from '@/components/SourcesManager';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const sources = await db
    .select()
    .from(schema.sources)
    .orderBy(asc(schema.sources.category), asc(schema.sources.name));

  return (
    <div className="py-6 space-y-4 px-3">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" /> Einstellungen
      </Link>
      <div className="flex items-center gap-2">
        <Rss className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-semibold">Quellen verwalten</h1>
      </div>

      <SourcesManager
        initialSources={sources.map((s) => ({
          ...s,
          lastFetchAt: s.lastFetchAt?.toISOString() ?? null,
          lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
