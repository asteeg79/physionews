/**
 * Rate-Limit — einfacher In-Memory-Bucket-Counter pro Schlüssel (typisch IP).
 *
 * Verwendung: Schutz für /api/refresh-on-demand vor Spam (1 Request/5min/IP).
 *
 * Limitierung: Im-Memory-Map → funktioniert nur in derselben Function-Instanz.
 * Bei mehreren Vercel-Instanzen würde der Counter pro Instanz separat zählen.
 * Für unsere Single-User-PWA ist das akzeptabel. Bei Mehr-Nutzer-Deployment
 * → auf Upstash Redis o.ä. umstellen.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Anzahl erlaubter Requests im Zeitfenster */
  limit: number;
  /** Zeitfenster in Sekunden */
  windowSeconds: number;
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: options.limit - 1, resetIn: options.windowSeconds };
  }

  if (existing.count >= options.limit) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: options.limit - existing.count,
    resetIn: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Best-effort IP-Erkennung aus typischen Vercel/Cloudflare-Headern. */
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    'unknown'
  );
}
