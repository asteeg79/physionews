'use client';

import { useState } from 'react';
import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import { formatRelative, formatDate } from '@/lib/format-date';
import type { NewsItem, Source } from '@/db/schema';
import { NewsDetailSheet } from './NewsDetailSheet';

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

/**
 * News-Card — KOMPLETT NEUE Architektur (v4).
 *
 * Frühere Versionen hatten ein In-Place-Accordion (expand-Toggle, dynamische
 * Höhe, line-clamp-Wechsel, livePreview ändert Text-Inhalt). Auf iOS-Safari
 * hat das wiederholt zu "Phantom-Höhe"-Bugs geführt, die mit verschiedensten
 * Tricks nie vollständig stabil wurden.
 *
 * v4 ändert das Konzept grundsätzlich:
 *  - Card ist IMMER kompakt (Header + Title + 2-Zeilen-Preview + Chips).
 *    KEINE Höhenänderung, kein State-getriebener Layout-Wechsel.
 *  - Tap öffnet ein Bottom-Sheet-Overlay (`NewsDetailSheet`), das den
 *    Volltext zeigt. Das Sheet ist ein Portal-Render in <body>, die Liste
 *    dahinter bleibt physisch unverändert.
 *  - iOS-Safari kann strukturell keine Phantom-Höhen mehr erzeugen, weil
 *    die Card-Geometrie konstant bleibt.
 */
export function NewsCard({ item, onRead }: NewsCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [optimisticRead, setOptimisticRead] = useState(item.isRead);
  const isRead = item.isRead || optimisticRead;
  const isHighlighted = isHighlightedSource(item.source.name);

  const markReadOnce = () => {
    if (isRead) return;
    setOptimisticRead(true);
    onRead?.(item.id);
    fetch(`/api/news/${item.id}/read`, { method: 'POST' }).catch(() => undefined);
  };

  const handleOpen = () => {
    markReadOnce();
    setSheetOpen(true);
  };

  // Card-Klassen — konstant, da kein expand-State existiert.
  let cardClasses = 'rounded-xl border-2 transition-colors duration-150 ';
  if (isRead) {
    cardClasses += 'bg-card border-border opacity-70';
  } else if (isHighlighted) {
    cardClasses += 'bg-brand-soft border-brand shadow-sm';
  } else {
    cardClasses += 'bg-card border-brand/70';
  }

  return (
    <>
      <article className={cardClasses} data-card-version="v4">
        <button
          type="button"
          onClick={handleOpen}
          className="w-full text-left p-4 cursor-pointer"
        >
          {/* Header: Quelle, Zeit, Read-Check */}
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
            </div>
          </div>

          {/* Titel — IMMER 2 Zeilen line-clamped, kein dynamischer Wechsel.
              Da der Textinhalt NIE wechselt (nur item.title), gibt es kein
              iOS-Layout-Problem mit -webkit-line-clamp. */}
          <h2
            className={`font-semibold text-sm leading-snug mb-1 ${
              isRead ? 'text-muted-foreground' : 'text-foreground'
            }`}
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {item.title}
          </h2>

          {/* Summary-Preview — IMMER nur item.summary (statischer Text),
              max 2 Zeilen. Kein livePreview hier — siehe v3-Bugfix-Kommentare
              in der Git-History. */}
          {item.summary && (
            <p
              className="text-xs leading-relaxed text-muted-foreground"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {item.summary}
            </p>
          )}
        </button>

        {/* Topic-Tags */}
        {item.topics && item.topics.length > 0 && (
          <TopicChips topics={item.topics} muted={isRead} />
        )}
      </article>

      {/* Detail-Sheet (Portal nach body) */}
      {sheetOpen && (
        <NewsDetailSheet item={item} onClose={() => setSheetOpen(false)} />
      )}
    </>
  );
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
