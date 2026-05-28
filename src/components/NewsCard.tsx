'use client';

import { useState } from 'react';
import { Check, Star } from 'lucide-react';
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
 *  2. Publikationen über die Marke pt / physiotherapeuten.de
 *     (sowohl der via-Google-News-Quellen als auch die offizielle physio.de)
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
  // Optimistic UI: sofort als gelesen anzeigen beim Klick
  const [optimisticRead, setOptimisticRead] = useState(item.isRead);
  const isRead = item.isRead || optimisticRead;
  const isHighlighted = isHighlightedSource(item.source.name);

  const handleClick = () => {
    if (!isRead) {
      setOptimisticRead(true);
      onRead?.(item.id);
      // Fire-and-forget: API informieren
      fetch(`/api/news/${item.id}/read`, { method: 'POST' }).catch(() => {
        // Bei Netzwerk-Fehler: kein User-Impact, beim nächsten Refresh wird der DB-Stand neu geladen
      });
    }
  };

  // Styling-Logik
  // - Hervorgehoben + ungelesen → kräftiger Grün-Rahmen + Soft-Background
  // - Normal + ungelesen → Grün-Rahmen
  // - Gelesen → grau, opacity reduziert, Haken
  let cardClasses = 'block rounded-xl border-2 overflow-hidden transition-all group hover:shadow-md ';
  if (isRead) {
    cardClasses += 'bg-card border-border opacity-70 hover:opacity-100';
  } else if (isHighlighted) {
    cardClasses += 'bg-brand-soft border-brand shadow-sm hover:shadow-md';
  } else {
    cardClasses += 'bg-card border-brand/70 hover:border-brand';
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cardClasses}
      aria-label={`${item.title} — ${isRead ? 'bereits gelesen' : 'ungelesen'}`}
    >
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          {isHighlighted && (
            <Star
              className="w-3.5 h-3.5 text-brand shrink-0"
              aria-label="Hervorgehobene Quelle"
              fill="currentColor"
            />
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
          {isRead && (
            <span
              className="ml-auto inline-flex items-center gap-0.5 text-xs text-brand shrink-0"
              aria-label="Gelesen"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
            </span>
          )}
        </div>

        <h2
          className={`font-semibold text-sm leading-snug line-clamp-2 mb-1 transition-colors group-hover:text-brand ${
            isRead ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {item.title}
        </h2>

        {item.summary && (
          <p
            className={`text-xs line-clamp-2 leading-relaxed ${
              isRead ? 'text-muted-foreground/70' : 'text-muted-foreground'
            }`}
          >
            {item.summary}
          </p>
        )}
      </div>

      {item.imageUrl && (
        <div className="w-full aspect-video overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt=""
            className={`w-full h-full object-cover transition-opacity ${
              isRead ? 'opacity-70' : ''
            }`}
            loading="lazy"
          />
        </div>
      )}
    </a>
  );
}
