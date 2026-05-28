import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';

export function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) {
    return formatDistanceToNow(date, { addSuffix: true, locale: de });
  }
  if (diffDays < 7) {
    return format(date, 'EEEE', { locale: de }); // "Montag"
  }
  return format(date, 'dd.MM.', { locale: de }); // "14.05."
}

export function formatDate(date: Date): string {
  return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
}
