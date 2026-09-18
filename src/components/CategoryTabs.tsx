'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Microscope, Scale, Megaphone, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EbpToggle } from './EbpToggle';
import { VISIBLE_CATEGORIES, CATEGORY_LABELS } from '@/lib/categories';
import type { VisibleCategory } from '@/lib/categories';

const ICONS: Record<VisibleCategory, LucideIcon> = {
  berufspolitik: Megaphone,
  recht: Scale,
  evidenz: Microscope,
};

/**
 * Aus VISIBLE_CATEGORIES abgeleitet statt separat gepflegt. Genau diese
 * Doppelpflege hatte die Tabs auf Kategorien zeigen lassen, die keine
 * Quelle mehr benutzte.
 */
const TABS = [
  { label: 'Alle', href: '/', icon: LayoutGrid },
  ...VISIBLE_CATEGORIES.map((cat) => ({
    label: CATEGORY_LABELS[cat],
    href: `/kategorie/${cat}`,
    icon: ICONS[cat],
  })),
];

export function CategoryTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Kategorien"
      className="sticky top-14 z-40 bg-background border-b border-border overflow-x-auto"
    >
      <div className="container max-w-2xl mx-auto px-4">
        <div className="flex items-center gap-1 py-1 min-w-max">
          {TABS.map((tab) => {
            const isActive =
              tab.href === '/' ? pathname === '/' : pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {tab.label}
              </Link>
            );
          })}
          <span className="w-px h-5 bg-border mx-1 self-center" aria-hidden="true" />
          <EbpToggle />
        </div>
      </div>
    </nav>
  );
}
