import type { Source } from '@/data/types';

export interface RawNewsItem {
  title: string;
  summary?: string;
  url: string;
  publishedAt: Date;
  imageUrl?: string;
}

export interface SourceAdapter {
  readonly typeIdentifier: string;
  fetch(source: Source): Promise<RawNewsItem[]>;
}
