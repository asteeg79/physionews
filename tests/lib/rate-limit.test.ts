import { describe, it, expect } from 'vitest';
import { rateLimit, clientIpFrom } from '../../src/lib/rate-limit';

describe('rateLimit', () => {
  it('erlaubt erste N Requests bis zum Limit', () => {
    const opts = { limit: 3, windowSeconds: 60 };
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    // 4. Request → blockiert
    expect(rateLimit(key, opts).allowed).toBe(false);
  });

  it('schließt nach Window-Ablauf wieder auf', async () => {
    const key = `test-window-${Date.now()}-${Math.random()}`;
    const opts = { limit: 1, windowSeconds: 1 };
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 1100));
    expect(rateLimit(key, opts).allowed).toBe(true);
  });

  it('liefert remaining korrekt zurück', () => {
    const key = `test-rem-${Date.now()}-${Math.random()}`;
    const r1 = rateLimit(key, { limit: 5, windowSeconds: 60 });
    expect(r1.remaining).toBe(4);
    const r2 = rateLimit(key, { limit: 5, windowSeconds: 60 });
    expect(r2.remaining).toBe(3);
  });

  it('verschiedene Keys haben separate Buckets', () => {
    const a = `test-a-${Date.now()}`;
    const b = `test-b-${Date.now()}`;
    rateLimit(a, { limit: 1, windowSeconds: 60 });
    expect(rateLimit(b, { limit: 1, windowSeconds: 60 }).allowed).toBe(true);
  });
});

describe('clientIpFrom', () => {
  it('liest x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4' });
    expect(clientIpFrom(h)).toBe('1.2.3.4');
  });

  it('nimmt den ersten Wert aus einer XFF-Kette', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(clientIpFrom(h)).toBe('1.2.3.4');
  });

  it('fällt auf x-real-ip zurück', () => {
    const h = new Headers({ 'x-real-ip': '10.0.0.1' });
    expect(clientIpFrom(h)).toBe('10.0.0.1');
  });

  it('liefert "unknown" wenn keine Header da sind', () => {
    expect(clientIpFrom(new Headers())).toBe('unknown');
  });
});
