'use client';

import { useState } from 'react';
import { Check, Star, ExternalLink, ChevronDown, Loader2 } from 'lucide-react';
import { formatRelative, formatDate } from '@/lib/format-date';
import type { NewsItem, Source } from '@/db/schema';

type SourceLight = Pick<Source, 'id' | 'name' | 'category' | 'iconName'>;

interface NewsCardProps {
  item: NewsItem & { source: SourceLight };
  onRead?: (id: string) => void;
}

/**
 * Hervorgehoben werden zwei Quellen-Gruppen:
 *  1. Alle Inhalte von Rechtsanwalt Benjamin Alt
 *  2. Publikationen über die Marke pt / physiotherapeuten.de / physio.de
 */
function isHighlightedSource(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('benjamin alt') ||
    lower.includes('ra benjamin') ||
    lower.includes('physiotherapeuten.de') ||
    lower.startsWith('physio.de') ||
    lower.includes('pt zeitschrift')
  );
}

export function NewsCard({ item, onRead }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [optimisticRead, setOptimisticRead] = useState(item.isRead);
  const isRead = item.isRead || optimisticRead;
  const isHighlighted = isHighlightedSource(item.source.name);

  // Live-Vorschau-Lazy-Loading
  const [livePreview, setLivePreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const hasInitialSummary = !!(item.summary && item.summary.length >= 60);
  const displaySummary = livePreview ?? item.summary ?? null;

  const markReadOnce = () => {
    if (isRead) return;
    setOptimisticRead(true);
    onRead?.(item.id);
    fetch(`/api/news/${item.id}/read`, { method: 'POST' }).catch(() => undefined);
  };

  const loadLivePreview = async () => {
    if (livePreview || previewLoading || previewFailed) return;
    if (hasInitialSummary) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/news/${item.id}/preview`);
      const body = (await res.json()) as { summary?: string | null };
      if (body.summary && body.summary.length > 30) setLivePreview(body.summary);
      else setPreviewFailed(true);
    } catch {
      setPreviewFailed(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      markReadOnce();
      void loadLivePreview();
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    markReadOnce();
  };

  // Card-Klassen — KEIN transition-all, nur transition-colors (iOS-freundlich)
  let cardClasses = 'rounded-xl border-2 overflow-hidden transition-colors duration-150 ';
  if (isRead && !expanded) {
    cardClasses += 'bg-card border-border opacity-70';
  } else if (isHighlighted) {
    cardClasses += 'bg-brand-soft border-brand shadow-sm';
  } else {
    cardClasses += 'bg-card border-brand/70';
  }
  if (expanded) cardClasses += ' shadow-md';

  return (
    <article className={cardClasses}>
      {/* Header (klickbar zum Aufklappen) */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full text-left p-4 cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          {isHighlighted && (
            <Star className="w-3.5 h-3.5 text-brand shrink-0" fill="currentColor" aria-hidden="true" />
          )}
          <span
            className={`text-xs font-medium truncate ${
              isHighlighted ? 'text-brand' : 'text-muted-foreground'
            }`}
          >
            {item.source.name}
          </span>
          <span className="text-xs text-muted-foreground/50">·</span>
          <time
            dateTime={item.publishedAt.toISOString()}
            className="text-xs text-muted-foreground shrink-0"
            title={formatDate(item.publishedAt)}
          >
            {formatRelative(item.publishedAt)}
          </time>

          <div className="ml-auto flex items-center gap-1 shrink-0">
            {isRead && (
              <Check className="w-4 h-4 text-brand" strokeWidth={3} aria-label="Gelesen" />
            )}
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${
                expanded ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Titel: kollabiert auf 2 Zeilen, expanded zeigt alles.
            Wichtig für iOS-Safari: <span> mit display:-webkit-box bleibt konstant,
            wir ändern nur den -webkit-line-clamp-Wert über eine inline Style. */}
        <h2
          className={`font-semibold text-sm leading-snug mb-1 ${
            isRead ? 'text-muted-foreground' : 'text-foreground'
          }`}
          style={
            expanded
              ? { display: 'block' }
              : {
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }
          }
        >
          {item.title}
        </h2>

        {/* Preview-Snippet im kollabierten Zustand (max 2 Zeilen) */}
        {!expanded && displaySummary && (
          <p
            className="text-xs leading-relaxed text-muted-foreground"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {displaySummary}
          </p>
        )}
      </button>

      {/* Bild — wird im KOLLABIERTEN Zustand unter dem Button gezeigt.
          Im EXPANDED-Zustand zeigen wir das gleiche Bild innerhalb der expanded-Sektion,
          damit es nicht zwischen kollabiert/expanded "springt". */}
      {!expanded && item.imageUrl && (
        <div className="w-full aspect-video overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt=""
            className={`w-full h-full object-cover ${isRead ? 'opacity-70' : ''}`}
            loading="lazy"
          />
        </div>
      )}

      {/* Expanded-Bereich — wird komplett aus dem DOM entfernt beim Kollabieren */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          {previewLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Vorschau wird geladen…
            </div>
          ) : displaySummary ? (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {displaySummary}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Vorschau nicht abrufbar — vollständiger Artikel öffnet sich über den Link unten.
            </p>
          )}

          {item.imageUrl && (
            <div className="w-full aspect-video overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-1 gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpen}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline shrink-0"
            >
              alles lesen
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <span className="text-xs text-muted-foreground truncate">
              {shortDomain(item.url)}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

function shortDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
