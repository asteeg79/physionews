'use client';

/**
 * NewsList — orchestriert die Anzeige aller News.
 *
 * Lade-Strategie (UX-optimiert für rapide Filter-Wechsel):
 *  - Erste Load: Skeleton-Karten
 *  - Folge-Wechsel: alte Items bleiben sichtbar, oben erscheint eine
 *    dezente Progress-Bar — sobald neue Daten da sind, wird ausgetauscht
 *  - Browser-Cache (max-age=20) macht häufige Filter-Wechsel instant
 *
 * Time-Buckets werden client-seitig aus publishedAt berechnet.
 */

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { TimeBucketSection } from './TimeBucketSection';
import { TopNewsSection } from './TopNewsSection';
import { ActiveFilters } from './ActiveFilters';
import { getTimeBucket, BUCKET_ORDER, type TimeBucket } from '@/lib/time-bucket';
import type { NewsCategory, NewsItemWithSource } from '@/data/types';
import {
  EMPTY_READ_STATE,
  isItemRead,
  loadReadState,
  markRead,
  type ClientNewsItem,
  type ReadState,
} from '@/lib/read-state';
import { withQuery } from '@/lib/query-string';

interface NewsListProps {
  category?: NewsCategory;
}

export function NewsList({ category }: Readonly<NewsListProps>) {
  const sp = useSearchParams();
  const q = sp.get('q')?.trim() ?? '';
  const tag = sp.get('tag')?.trim() ?? '';
  const ebp = sp.get('ebp') === 'true';
  const hasFilter = q.length > 0 || tag.length > 0 || ebp;

  const [items, setItems] = useState<NewsItemWithSource[] | null>(null);
  const [topNews, setTopNews] = useState<NewsItemWithSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Pending nur für „still loading"-Indikator, blockiert NICHT das Rendering der alten Liste
  const [pending, setPending] = useState(false);
  // Der Lesestand liegt im localStorage und steht erst nach dem Mount zur
  // Verfügung — beim Server-Rendering gilt alles als ungelesen.
  const [readState, setReadState] = useState<ReadState>(EMPTY_READ_STATE);

  useEffect(() => {
    setReadState(loadReadState());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    if (ebp) params.set('ebp', 'true');
    const mainUrl = withQuery('/api/news', params);
    // Top-News kommen IMMER ungeachtet der Kategorie — bei aktiver
    // Suche oder Tag-Filter werden sie ausgeblendet (passt nicht zum Filter)
    const topUrl = hasFilter ? null : `/api/news?topNews=true`;

    setPending(true);
    setError(null);

    let cancelled = false;
    Promise.all([
      fetch(mainUrl).then((r) => r.json()),
      topUrl ? fetch(topUrl).then((r) => r.json()) : Promise.resolve([]),
    ])
      .then(([mainData, topData]: [NewsItemWithSource[], NewsItemWithSource[]]) => {
        if (cancelled) return;
        const hydrate = (item: NewsItemWithSource): NewsItemWithSource => ({
          ...item,
          publishedAt: new Date(item.publishedAt),
          fetchedAt: new Date(item.fetchedAt),
        });
        // Transition: Re-Render geschieht im Hintergrund, alte Liste bleibt
        // sichtbar bis der neue State frisch ist.
        startTransition(() => {
          setItems(mainData.map(hydrate));
          setTopNews(topData.map(hydrate));
        });
      })
      .catch(() => {
        if (!cancelled) setError('Nachrichten konnten nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, q, tag, ebp, hasFilter]);

  if (items === null) {
    // Allererste Load — Skeleton zeigen
    return <NewsListSkeleton />;
  }
  if (error) {
    return <p className="py-8 text-center text-sm text-destructive">{error}</p>;
  }

  // Lesestand dieses Geräts an die Items heften
  const withReadState = (item: NewsItemWithSource): ClientNewsItem => ({
    ...item,
    isRead: isItemRead(readState, item),
  });

  // Top-News-IDs aus der Hauptliste entfernen, damit sie nicht doppelt erscheinen
  const topIds = new Set(topNews.map((t) => t.id));
  const topNewsItems = topNews.map(withReadState);
  const restItems = items.filter((i) => !topIds.has(i.id)).map(withReadState);

  const bucketed = BUCKET_ORDER.reduce<Record<TimeBucket, ClientNewsItem[]>>(
    (acc, b) => ({ ...acc, [b]: [] }),
    {} as Record<TimeBucket, ClientNewsItem[]>
  );
  for (const item of restItems) {
    bucketed[getTimeBucket(item.publishedAt)].push(item);
  }

  const onItemRead = (id: string) => {
    setReadState((prev) => markRead(prev, id));
  };

  return (
    <div className="py-2 relative">
      {/* Dezente Progress-Bar oben während des Reloads */}
      {pending && <PendingBar />}

      <ActiveFilters q={q} tag={tag} ebp={ebp} matchCount={items.length} />

      {items.length === 0 && topNews.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">Keine Treffer.</p>
          <p className="text-muted-foreground text-xs mt-1">
            {hasFilter
              ? 'Filter anpassen oder zurücksetzen.'
              : 'Starte einen Refresh über das Aktualisieren-Symbol oben.'}
          </p>
        </div>
      ) : (
        <>
          <TopNewsSection items={topNewsItems} onItemRead={onItemRead} />
          {BUCKET_ORDER.map((bucket) => (
            <TimeBucketSection
              key={bucket}
              bucket={bucket}
              items={bucketed[bucket]}
              onItemRead={onItemRead}
            />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Dünner Indeterminate-Progress-Balken am oberen Rand der Liste,
 * zeigt einen laufenden Fetch ohne das UI zu blockieren.
 */
function PendingBar() {
  return (
    <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden">
      <div
        className="h-full bg-brand"
        style={{
          width: '40%',
          animation: 'pn-progress 1.2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes pn-progress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
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
