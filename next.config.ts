import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';

const withPWA = withSerwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default withPWA(nextConfig);
