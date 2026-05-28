'use client';

import { useEffect, useState } from 'react';
import { TimeBucketSection } from './TimeBucketSection';
import { TopNewsSection } from './TopNewsSection';
import { getTimeBucket, BUCKET_ORDER, type TimeBucket } from '@/lib/time-bucket';
import type { NewsItem, Source, NewsCategory } from '@/db/schema';

// Anzahl Top-News (sortiert nach Relevanz) die oben in der eigenen Sektion stehen
const TOP_NEWS_COUNT = 3;
// Items werden zusätzlich nur in TopNews aufgenommen, wenn sie Relevanz >= dem Wert haben
const TOP_NEWS_MIN_SCORE = 8;

type NewsItemWithSource = NewsItem & { source: Pick<Source, 'id' | 'name' | 'category' | 'iconName'> };

interface NewsListProps {
  category?: NewsCategory;
}

export function NewsList({ category }: NewsListProps) {
  const [items, setItems] = useState<NewsItemWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
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
  }, [category]);

  if (loading) return <NewsListSkeleton />;
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground text-sm">Noch keine Nachrichten vorhanden.</p>
        <p className="text-muted-foreground text-xs mt-1">
          Starte einen Refresh über das Aktualisieren-Symbol oben.
        </p>
      </div>
    );
  }

  // Top-News: die höchstrelevanten Items (Score sortiert), die NICHT bereits gelesen sind
  // Wenn alle bereits gelesen sind, zeigen wir die Top-3 trotzdem (kein Verstecken)
  const sortedByRelevance = [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const unreadHighRelevance = sortedByRelevance.filter(
    (i) => !i.isRead && i.relevanceScore >= TOP_NEWS_MIN_SCORE
  );
  const topNewsCandidates = unreadHighRelevance.length > 0 ? unreadHighRelevance : sortedByRelevance;
  const topNews = topNewsCandidates.slice(0, TOP_NEWS_COUNT);
  const topNewsIds = new Set(topNews.map((i) => i.id));

  // Übrige Items für die Zeit-Bucket-Liste
  const restItems = items.filter((i) => !topNewsIds.has(i.id));

  const bucketed = BUCKET_ORDER.reduce<Record<TimeBucket, NewsItemWithSource[]>>(
    (acc, b) => ({ ...acc, [b]: [] }),
    {} as Record<TimeBucket, NewsItemWithSource[]>
  );
  for (const item of restItems) {
    bucketed[getTimeBucket(item.publishedAt)].push(item);
  }

  const onItemRead = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)));

  return (
    <div className="py-2">
      <TopNewsSection items={topNews} onItemRead={onItemRead} />

      {BUCKET_ORDER.map((bucket) => (
        <TimeBucketSection
          key={bucket}
          bucket={bucket}
          items={bucketed[bucket]}
          onItemRead={onItemRead}
        />
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
