'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { Check, Star, ExternalLink, ChevronDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
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

  // iOS-Safari hält gelegentlich die Layout-Höhe aus dem expanded-Zustand
  // fest, auch wenn der Subtree unmounted ist. Zwei-Stufen-Repaint-Trick:
  // direkt nach dem DOM-Update einen Reflow erzwingen, dann nach dem
  // nächsten Paint nochmal — fängt Safari-spezifische Verzögerungen ab.
  const articleRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    void el.offsetHeight;
    const raf = requestAnimationFrame(() => {
      void el.offsetHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [expanded]);

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

  // Card-Klassen — KEIN transition-all, nur transition-colors (iOS-freundlich).
  // KEIN `overflow-hidden`: in Kombination mit dem Collapse-Toggle hat iOS
  // Safari die alte Höhe der ausgeklappten Box gecacht und nicht
  // neu berechnet. Ohne overflow-hidden ist der Reflow zuverlässig.
  // Border-Radius funktioniert trotzdem sauber, da keine Bilder über
  // die Ecken laufen.
  let cardClasses = 'rounded-xl border-2 transition-colors duration-150 ';
  if (isRead && !expanded) {
    cardClasses += 'bg-card border-border opacity-70';
  } else if (isHighlighted) {
    cardClasses += 'bg-brand-soft border-brand shadow-sm';
  } else {
    cardClasses += 'bg-card border-brand/70';
  }
  if (expanded) cardClasses += ' shadow-md';

  return (
    <article
      ref={articleRef}
      // KEY-REMOUNT: Bei jedem Toggle wird der article-Knoten von React
      // komplett unmounted und neu erzeugt. Das ist die Holzhammer-Lösung
      // gegen iOS-Safari, das nach dem Collapse intern gemerkte Layout-
      // Dimensionen für den vorherigen Zustand weitergibt. Der Performance-
      // Hit ist vernachlässigbar (wenige DOM-Knoten pro Karte), der State
      // der NewsCard-Komponente bleibt erhalten (nur das DOM wird neu).
      key={expanded ? 'open' : 'closed'}
      className={cardClasses}
      // Zusätzliche Layout-Hinweise (überholend, schaden nicht):
      style={{ display: 'block', height: 'auto', maxHeight: 'none', minHeight: 0 }}
      // Debug-Marker für Web-Inspector — bei Bug-Reports sofort sichtbar
      // ob die UI-Komponente überhaupt den richtigen State trägt.
      data-expanded={expanded}
      data-card-version="v3"
    >
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

        {/* Titel: -webkit-box bleibt KONSTANT — wir ändern nur den
            line-clamp-Wert (2 vs. sehr hoch). iOS-Safari aktualisiert
            den Clamp zuverlässig nur, wenn der Display-Mode nicht wechselt. */}
        <h2
          className={`font-semibold text-sm leading-snug mb-1 ${
            isRead ? 'text-muted-foreground' : 'text-foreground'
          }`}
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: expanded ? 99 : 2,
            overflow: 'hidden',
          }}
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

      {/* Topic-Tags: kleine Chips unter dem Header — klickbar als Filter */}
      {item.topics && item.topics.length > 0 && (
        <TopicChips topics={item.topics} muted={isRead && !expanded} />
      )}

      {/* Bilder werden bewusst nicht angezeigt — viele Quellen liefern kein
          og:image, das Ergebnis war zu uneinheitlich. Konsistent ohne ist
          aufgeräumter. */}

      {/* Expanded-Bereich — Conditional-Render (NICHT `hidden`-Attribut).
          Frühere Version nutzte `hidden`, das wurde aber auf iOS-Safari
          mit Tailwind v4 von einer Layout-Regel überschrieben und der
          Bereich blieb effektiv sichtbar (Phantom-Höhe blieb stehen).
          Reine React-Unmount funktioniert jetzt, nachdem `contain: content`
          weg ist und die Article-Box explizit display:block trägt. */}
      {expanded && (
      <div
        className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3"
      >
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

/**
 * Topic-Chips — klickbare Tags, die als Filter über `?tag=…` gesetzt werden.
 * Verhindert Card-Toggle durch stopPropagation auf dem Link.
 */
function TopicChips({ topics, muted }: { topics: string[]; muted: boolean }) {
  return (
    <div className="px-4 pb-3 -mt-2 flex flex-wrap gap-1.5">
      {topics.map((t) => (
        <Link
          key={t}
          href={`/?tag=${encodeURIComponent(t)}`}
          onClick={(e) => e.stopPropagation()}
          className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
            muted
              ? 'bg-muted border-border text-muted-foreground'
              : 'bg-brand-soft border-brand/30 text-brand hover:bg-brand hover:text-white'
          }`}
        >
          {t}
        </Link>
      ))}
    </div>
  );
}
