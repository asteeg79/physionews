'use client';

/**
 * NewsDetailSheet — Bottom-Sheet-Overlay mit Volltext-Vorschau einer News.
 *
 * Wird vom NewsCard geöffnet (Portal nach document.body). Die News-Liste
 * dahinter bleibt unverändert — kein Layout-Reflow, keine Höhenänderung
 * der Cards. Damit ist der iOS-Safari-Phantom-Höhe-Bug strukturell
 * unmöglich geworden.
 *
 * Bedienung:
 *  - X-Button rechts oben → schließen
 *  - Tap auf Backdrop → schließen
 *  - ESC-Taste → schließen
 *  - "alles lesen" öffnet den vollständigen Artikel in neuem Tab
 *
 * Inhalte:
 *  - Header: Quelle, Datum
 *  - Titel, Topic-Chips
 *  - Live-Preview (Volltext) — lazy geladen
 *  - Link zum Originalartikel
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { formatDate, formatRelative } from '@/lib/format-date';
import type { NewsItemWithSource } from '@/data/types';

interface NewsDetailSheetProps {
  item: NewsItemWithSource;
  onClose: () => void;
}

export function NewsDetailSheet({ item, onClose }: NewsDetailSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [livePreview, setLivePreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  // Portal-Target erst nach Client-Mount nutzen (SSR-safe).
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC schließt das Sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Body-Scroll sperren, solange das Sheet offen ist.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Live-Preview lazy laden, sobald das Sheet offen ist.
  useEffect(() => {
    const hasInitialSummary = !!(item.summary && item.summary.length >= 60);
    if (hasInitialSummary) return;

    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/news/${item.id}/preview`)
      .then((r) => r.json() as Promise<{ summary?: string | null }>)
      .then((body) => {
        if (cancelled) return;
        if (body.summary && body.summary.length > 30) {
          setLivePreview(body.summary);
        } else {
          setPreviewFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.summary]);

  const fullText = livePreview ?? item.summary ?? null;

  if (!mounted) return null;

  const sheet = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-sheet-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Sheet-Container */}
      <div
        className={[
          'relative w-full sm:max-w-2xl',
          'bg-card text-foreground',
          'rounded-t-2xl sm:rounded-2xl',
          'shadow-2xl',
          'max-h-[90dvh] flex flex-col',
          'animate-pn-sheet-in',
        ].join(' ')}
      >
        {/* Grip-Indicator (iOS-style) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {item.source.name}
            </p>
            <time
              dateTime={item.publishedAt.toISOString()}
              className="text-xs text-muted-foreground/70"
              title={formatDate(item.publishedAt)}
            >
              {formatRelative(item.publishedAt)}
            </time>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollbarer Inhalt */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <h2
            id="news-sheet-title"
            className="font-semibold text-base leading-snug mb-3"
          >
            {item.title}
          </h2>

          {item.topics && item.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {item.topics.map((t) => (
                <Link
                  key={t}
                  href={`/?tag=${encodeURIComponent(t)}`}
                  onClick={onClose}
                  className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border bg-brand-soft border-brand/30 text-brand"
                >
                  {t}
                </Link>
              ))}
            </div>
          )}

          {previewLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Vorschau wird geladen …
            </div>
          ) : fullText ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {fullText}
            </p>
          ) : previewFailed ? (
            <p className="text-xs italic text-muted-foreground">
              Vorschau nicht abrufbar — vollständiger Artikel öffnet sich über den Link unten.
            </p>
          ) : null}
        </div>

        {/* Fuß: Link zum Original */}
        <div className="border-t border-border/50 p-4 flex items-center justify-between gap-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            alles lesen
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
          <span className="text-xs text-muted-foreground truncate">
            {shortDomain(item.url)}
          </span>
        </div>
      </div>

      {/* Sheet-Animation Keyframes */}
      <style>{`
        @keyframes pn-sheet-in {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-pn-sheet-in {
          animation: pn-sheet-in 180ms ease-out;
        }
      `}</style>
    </div>
  );

  return createPortal(sheet, document.body);
}

function shortDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
