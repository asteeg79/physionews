import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Build-Version zusammensetzen:
 *  - `version` aus package.json (semver)
 *  - kurzer Git-SHA (Vercel liefert `VERCEL_GIT_COMMIT_SHA` automatisch,
 *    lokal fragen wir `git rev-parse` ab)
 *  - Build-Timestamp (ISO)
 * Format: `0.1.0+ab28dfb · 2026-05-29T14:32:01Z`
 */
function resolveBuildVersion(): string {
  let pkgVersion = '0.0.0';
  try {
    const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version?: string };
    if (pkg.version) pkgVersion = pkg.version;
  } catch {
    // ignore
  }

  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      sha = 'unknown';
    }
  }
  const shortSha = sha.slice(0, 7);

  const buildTime = new Date().toISOString();
  return `${pkgVersion}+${shortSha} · ${buildTime}`;
}

const APP_VERSION = resolveBuildVersion();

const nextConfig: NextConfig = {
  /**
   * Die Datendateien in `data/` werden zur Laufzeit per `fs` gelesen
   * (siehe src/data/json-store.ts). Der Build-Tracer erkennt das nicht von
   * allein — ohne diesen Eintrag fehlen die Dateien im Function-Bundle und
   * jede Route liefert leere Listen.
   *
   * Der Schlüssel wird als Substring gegen den Routen-Pfad gematcht, `/**`
   * trifft damit alle serverseitigen Routen.
   */
  outputFileTracingIncludes: {
    '/**': ['./data/**/*.json'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  env: {
    // Wird per Next.js inlined in alle Client-Bundles — somit ist die
    // im Browser laufende Version vergleichbar mit der Server-Version
    // (siehe /api/version).
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
};

// Service Worker / PWA nur in Production aktivieren —
// Serwist injiziert eine webpack-Config, die mit Turbopack (Next.js 16 Default) kollidiert.
const withPWA = withSerwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: isDev,
});

export default isDev ? nextConfig : withPWA(nextConfig);
