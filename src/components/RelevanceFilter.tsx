'use client';

import { Filter, FilterX } from 'lucide-react';

const STORAGE_KEY = 'physionews-show-all';

export function readShowAll(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function writeShowAll(value: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
}

interface RelevanceFilterProps {
  showAll: boolean;
  onChange: (showAll: boolean) => void;
  hiddenCount?: number | null;
}

export function RelevanceFilter({ showAll, onChange, hiddenCount }: RelevanceFilterProps) {
  const handleToggle = () => {
    const next = !showAll;
    writeShowAll(next);
    onChange(next);
  };

  return (
    <div className="flex items-center justify-between gap-2 mb-3 mt-2 px-1">
      <div className="text-xs text-muted-foreground">
        {showAll ? (
          <>Alle Beiträge</>
        ) : (
          <>
            Nur physiotherapie-relevante
            {hiddenCount !== null && hiddenCount !== undefined && hiddenCount > 0 && (
              <span> · {hiddenCount} ausgeblendet</span>
            )}
          </>
        )}
      </div>
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card border border-border hover:bg-muted transition-colors"
        aria-pressed={showAll}
      >
        {showAll ? (
          <>
            <FilterX className="w-3.5 h-3.5" aria-hidden="true" />
            Filter wieder an
          </>
        ) : (
          <>
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            Alle anzeigen
          </>
        )}
      </button>
    </div>
  );
}
