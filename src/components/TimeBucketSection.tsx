'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NewsCard } from './NewsCard';
import type { NewsItem, Source } from '@/db/schema';
import type { TimeBucket } from '@/lib/time-bucket';
import { BUCKET_LABELS } from '@/lib/time-bucket';

type NewsItemWithSource = NewsItem & { source: Pick<Source, 'id' | 'name' | 'category' | 'iconName'> };

interface TimeBucketSectionProps {
  bucket: TimeBucket;
  items: NewsItemWithSource[];
}

export function TimeBucketSection({ bucket, items }: TimeBucketSectionProps) {
  const [collapsed, setCollapsed] = useState(bucket === 'aelter');

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full text-left mb-3 group"
        aria-expanded={!collapsed}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
          {BUCKET_LABELS[bucket]}
        </h2>
        <span className="text-xs text-muted-foreground/60 ml-1">({items.length})</span>
        {bucket === 'aelter' && (
          <ChevronDown
            className={`w-3 h-3 text-muted-foreground ml-auto transition-transform ${
              collapsed ? '' : 'rotate-180'
            }`}
          />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
