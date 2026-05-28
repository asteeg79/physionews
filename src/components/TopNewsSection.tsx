'use client';

import { Sparkles } from 'lucide-react';
import { NewsCard } from './NewsCard';
import type { NewsItem, Source } from '@/db/schema';

type NewsItemWithSource = NewsItem & {
  source: Pick<Source, 'id' | 'name' | 'category' | 'iconName'>;
};

interface TopNewsSectionProps {
  items: NewsItemWithSource[];
  onItemRead?: (id: string) => void;
}

/**
 * Top-News oben in der Liste: die drei nach Relevanz höchsten Items.
 * Visuell hervorgehoben mit Brand-Akzent, eigener Header und Hintergrund.
 */
export function TopNewsSection({ items, onItemRead }: TopNewsSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-4 mb-6 -mx-2 px-2 py-4 bg-brand-soft rounded-2xl">
      <div className="flex items-center gap-2 mb-3 px-2">
        <Sparkles className="w-4 h-4 text-brand" aria-hidden="true" />
        <h2 className="font-heading font-bold text-sm tracking-wide uppercase text-brand">
          Top News
        </h2>
        <span className="text-xs text-muted-foreground">
          Die {items.length} relevantesten Beiträge
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} onRead={onItemRead} />
        ))}
      </div>
    </section>
  );
}
