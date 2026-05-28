'use client';

import Link from 'next/link';
import { Settings, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Logo } from './Logo';

export function Header() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/refresh-on-demand', { method: 'POST' });
      const body = (await res.json()) as {
        ok?: boolean;
        totalNew?: number;
        skipped?: boolean;
        reason?: string;
      };
      if (body.ok) {
        toast.success(`${body.totalNew ?? 0} neue Beiträge`);
        router.refresh();
      } else if (body.reason === 'too_recent') {
        toast.info('Wurde gerade erst aktualisiert.');
      } else if (body.reason === 'rate_limited') {
        toast.info('Bitte etwas warten — Limit erreicht.');
      } else if (body.reason === 'outside_window') {
        toast.info('Außerhalb des Refresh-Fensters.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Aktualisierung fehlgeschlagen');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          aria-label="PhysioNews — zur Startseite"
          className="transition-opacity hover:opacity-80"
        >
          <Logo size="md" />
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
              aria-hidden="true"
            />
          </button>

          <Link
            href="/settings"
            aria-label="Einstellungen"
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
