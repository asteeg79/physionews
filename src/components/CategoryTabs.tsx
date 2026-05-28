'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Alle', href: '/' },
  { label: 'Berufspolitik', href: '/kategorie/berufspolitik' },
  { label: 'Recht', href: '/kategorie/recht' },
  { label: 'Evidenz', href: '/kategorie/evidenz' },
  { label: 'Fortbildung', href: '/kategorie/fortbildung' },
  { label: 'Leitlinien', href: '/kategorie/leitlinien' },
];

export function CategoryTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Kategorien"
      className="sticky top-14 z-40 bg-background border-b border-border overflow-x-auto"
    >
      <div className="container max-w-2xl mx-auto px-4">
        <div className="flex gap-1 py-1 min-w-max">
          {TABS.map((tab) => {
            const isActive =
              tab.href === '/' ? pathname === '/' : pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
