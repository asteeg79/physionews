import { createHash } from 'crypto';

export function computeItemId(sourceId: string, url: string, title: string): string {
  const normalized = [
    sourceId,
    normalizeUrl(url),
    normalizeTitle(title),
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // UTM-Parameter und Tracking entfernen
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
    trackingParams.forEach((p) => u.searchParams.delete(p));
    // Trailing slash normalisieren
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\säöüß-]/g, '')
    .trim();
}
