import { berlinStartOfDay } from './timezone';

export type TimeBucket = 'heute' | 'woche' | 'monat' | 'aelter';

export function getTimeBucket(publishedAt: Date, now: Date = new Date()): TimeBucket {
  const todayStart = berlinStartOfDay(now);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (publishedAt >= todayStart) return 'heute';
  if (publishedAt >= weekStart) return 'woche';
  if (publishedAt >= monthStart) return 'monat';
  return 'aelter';
}

export const BUCKET_LABELS: Record<TimeBucket, string> = {
  heute: 'Heute',
  woche: 'Diese Woche',
  monat: 'Diesen Monat',
  aelter: 'Älter',
};

export const BUCKET_ORDER: TimeBucket[] = ['heute', 'woche', 'monat', 'aelter'];
