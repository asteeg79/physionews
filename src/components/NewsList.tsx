'use client';

/**
 * NewsList — orchestriert die Anzeige aller News.
 *
 * Lade-Strategie:
 *  - Parallel zwei API-Calls: alle Items (kategorie-gefiltert) und die
 *    AI-kuratierten Top-News (is_top_news=true)
 *  - Top-News werden aus der Hauptliste ausgeklammert (keine Doppel-Anzeige)
 *  - Top-News werden ungeachtet der Kategorie immer angezeigt (Übersicht)
 *
 * Time-Buckets (Heute/Diese Woche/Diesen Monat/Älter) werden client-seitig
 * aus publishedAt berechnet — siehe lib/time-bucket.ts.
 */

import { useEffect, useState } from 'react';
import { TimeBucketSection } from './TimeBucketSection';
import { TopNewsSection } from './TopNewsSection';
import { getTimeBucket, BUCKET_ORDER, type TimeBucket } from '@/lib/time-bucket';
import type { NewsItem, Source, NewsCategory } from '@/db/schema';

type NewsItemWithSource = NewsItem & {
  source: Pick<Source, 'id' | 'name' | 'category' | 'iconName'>;
};

interface NewsListProps {
  category?: NewsCategory;
}

export function NewsList({ category }: NewsListProps) {
  const [items, setItems] = useState<NewsItemWithSource[]>([]);
  const [topNews, setTopNews] = useState<NewsItemWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const mainUrl = `/api/news${params.toString() ? `?${params.toString()}` : ''}`;
    // Top-News kommen IMMER ungeachtet der Kategorie
    const topUrl = `/api/news?topNews=true`;

    setLoading(true);
    Promise.all([
      fetch(mainUrl).then((r) => r.json()),
      fetch(topUrl).then((r) => r.json()),
    ])
      .then(([mainData, topData]: [NewsItemWithSource[], NewsItemWithSource[]]) => {
        const hydrate = (item: NewsItemWithSource): NewsItemWithSource => ({
          ...item,
          publishedAt: new Date(item.publishedAt),
          fetchedAt: new Date(item.fetchedAt),
        });
        setItems(mainData.map(hydrate));
        setTopNews(topData.map(hydrate));
      })
      .catch(() => setError('Nachrichten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [category]);

  if (loading) return <NewsListSkeleton />;
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>;

  if (items.length === 0 && topNews.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground text-sm">Noch keine Nachrichten vorhanden.</p>
        <p className="text-muted-foreground text-xs mt-1">
          Starte einen Refresh über das Aktualisieren-Symbol oben.
        </p>
      </div>
    );
  }

  // Top-News-IDs aus der Hauptliste entfernen, damit sie nicht doppelt erscheinen
  const topIds = new Set(topNews.map((t) => t.id));
  const restItems = items.filter((i) => !topIds.has(i.id));

  // Bucketing nach Veröffentlichungs-Datum
  const bucketed = BUCKET_ORDER.reduce<Record<TimeBucket, NewsItemWithSource[]>>(
    (acc, b) => ({ ...acc, [b]: [] }),
    {} as Record<TimeBucket, NewsItemWithSource[]>
  );
  for (const item of restItems) {
    bucketed[getTimeBucket(item.publishedAt)].push(item);
  }

  /**
   * Lokales State-Update beim Lesen — vermeidet doppelte API-Calls
   * und hält das UI synchron mit dem Klick im Detail-Bereich.
   */
  const onItemRead = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)));
    setTopNews((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)));
  };

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
