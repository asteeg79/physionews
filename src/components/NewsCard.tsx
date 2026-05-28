import { formatRelative, formatDate } from '@/lib/format-date';
import type { NewsItem, Source } from '@/db/schema';

interface NewsCardProps {
  item: NewsItem & { source: Pick<Source, 'id' | 'name' | 'category' | 'iconName'> };
}

export function NewsCard({ item }: NewsCardProps) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block bg-card rounded-xl border border-border overflow-hidden hover:border-brand/50 hover:shadow-sm transition-all group ${
        !item.isRead ? 'border-l-4 border-l-brand' : ''
      }`}
    >
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs text-muted-foreground font-medium truncate">
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
        </div>

        <h2 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-brand transition-colors mb-1">
          {item.title}
        </h2>

        {item.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
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
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
    </a>
  );
}
