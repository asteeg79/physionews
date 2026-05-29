'use client';

/**
 * ActiveFilters — zeigt aktive Such- und Tag-Filter als Chips mit Schließen-Button.
 *
 * Aktive Filter werden über URL-Parameter (?q=…&tag=…) zentral gehalten.
 * Beim Schließen wird der entsprechende Param entfernt.
 */

import { Search, Tag, X } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface ActiveFiltersProps {
  q: string;
  tag: string;
  matchCount: number;
}

export function ActiveFilters({ q, tag, matchCount }: ActiveFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  if (!q && !tag) return null;

  const removeParam = (key: 'q' | 'tag') => {
    const params = new URLSearchParams(sp.toString());
    params.delete(key);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="flex items-center flex-wrap gap-2 px-1 pt-2 pb-3 text-xs">
      <span className="text-muted-foreground">
        {matchCount} {matchCount === 1 ? 'Treffer' : 'Treffer'} ·
      </span>
      {q && <FilterChip icon={<Search className="w-3 h-3" />} label={q} onRemove={() => removeParam('q')} />}
      {tag && <FilterChip icon={<Tag className="w-3 h-3" />} label={tag} onRemove={() => removeParam('tag')} />}
    </div>
  );
}

function FilterChip({
  icon,
  label,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-brand-soft border border-brand/30 text-foreground rounded-full pl-2.5 pr-1 py-1">
      <span className="text-brand">{icon}</span>
      <span className="truncate max-w-[12rem]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Filter „${label}" entfernen`}
        className="p-0.5 rounded-full hover:bg-brand/10 text-muted-foreground"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
