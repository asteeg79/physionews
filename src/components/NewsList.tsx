'use client';

import { useEffect, useState } from 'react';
import { TimeBucketSection } from './TimeBucketSection';
import { RelevanceFilter, readShowAll } from './RelevanceFilter';
import { getTimeBucket, BUCKET_ORDER, type TimeBucket } from '@/lib/time-bucket';
import type { NewsItem, Source, NewsCategory } from '@/db/schema';

type NewsItemWithSource = NewsItem & { source: Pick<Source, 'id' | 'name' | 'category' | 'iconName'> };

interface NewsListProps {
  category?: NewsCategory;
}

export function NewsList({ category }: NewsListProps) {
  const [items, setItems] = useState<NewsItemWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<boolean>(false);

  useEffect(() => {
    setShowAll(readShowAll());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (showAll) params.set('minRelevance', '0');
    const url = `/api/news${params.toString() ? `?${params.toString()}` : ''}`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setItems(
          data.map((item: NewsItemWithSource) => ({
            ...item,
            publishedAt: new Date(item.publishedAt),
            fetchedAt: new Date(item.fetchedAt),
          }))
        );
      })
      .catch(() => setError('Nachrichten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [category, showAll]);

  if (loading) return <NewsListSkeleton />;
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>;

  const filter = (
    <RelevanceFilter
      showAll={showAll}
      onChange={(v) => setShowAll(v)}
      hiddenCount={null /* wir zeigen die Zahl erst nach Toggle vorne */}
    />
  );

  if (items.length === 0) {
    return (
      <div>
        {filter}
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {showAll
              ? 'Noch keine Nachrichten vorhanden.'
              : 'Keine physiotherapie-spezifischen Beiträge.'}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {showAll
              ? 'Starte einen Refresh über das Aktualisieren-Symbol oben.'
              : 'Aktiviere „Alle anzeigen", um auch allgemeine Gesundheitsthemen zu sehen.'}
          </p>
        </div>
      </div>
    );
  }

  const bucketed = BUCKET_ORDER.reduce<Record<TimeBucket, NewsItemWithSource[]>>(
    (acc, b) => ({ ...acc, [b]: [] }),
    {} as Record<TimeBucket, NewsItemWithSource[]>
  );

  for (const item of items) {
    const bucket = getTimeBucket(item.publishedAt);
    bucketed[bucket].push(item);
  }

  return (
    <div className="py-2">
      {filter}
      {BUCKET_ORDER.map((bucket) => (
        <TimeBucketSection key={bucket} bucket={bucket} items={bucketed[bucket]} />
      ))}
    </div>
  );
}

function NewsListSkeleton() {
  return (
    <div className="py-2 space-y-3 mt-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
          <div className="h-3 bg-muted rounded w-32 mb-2" />
          <div className="h-4 bg-muted rounded w-full mb-1" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}
