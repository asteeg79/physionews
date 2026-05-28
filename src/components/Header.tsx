'use client';

import Link from 'next/link';
import { Settings, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch('/api/cron/refresh', {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET ?? '' },
      });
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-brand tracking-tight">
          PhysioNews
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Jetzt aktualisieren"
            className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>

          <Link
            href="/settings"
            aria-label="Einstellungen"
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
