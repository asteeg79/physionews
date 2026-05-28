import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
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
