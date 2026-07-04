/** @type {import('next').NextConfig} */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vermillion-kitsune-0e7b97.netlify.app';

// Security headers (CSP, X-Frame-Options, HSTS, Permissions-Policy, Referrer-Policy)
// have a single source of truth: middleware.ts → applySecurityHeaders(). Do not
// duplicate them here — the two sets drifted apart (DENY vs SAMEORIGIN, different
// CSP) and middleware overrides these values on every matched route anyway.
// Only headers for paths middleware never sees (/_next/static, /_next/image) live here.
const staticAssetHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Content-hashed build assets never change under the same URL.
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
];

const nextConfig = {
  reactStrictMode: true,
  // ESLint remains build-non-blocking until the lint debt is triaged;
  // type errors block the build — the typecheck debt was paid down to zero.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  compiler: {
    // Internal diagnostics must not leak to user consoles in production.
    removeConsole: { exclude: ['error'] },
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: staticAssetHeaders,
      },
      {
        source: '/_next/image:path*',
        headers: staticAssetHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/platform-v7',
        permanent: false,
      },
      {
        source: '/platform-v7/deals/:id',
        destination: '/platform-v7/deals/:id/clean',
        permanent: false,
      },
      {
        source: '/platform-v7/integrations',
        destination: '/platform-v7/connectors',
        permanent: true,
      },
      {
        source: '/platform-v7/marketplace',
        destination: '/platform-v7/lots',
        permanent: true,
      },
      {
        source: '/platform-v7/analytics',
        destination: '/platform-v7/executive',
        permanent: true,
      },
      {
        source: '/platform-v7/counterparty',
        destination: '/platform-v7/companies',
        permanent: true,
      },
      {
        source: '/platform-v7/counterparty/:path*',
        destination: '/platform-v7/companies/:path*',
        permanent: true,
      },
      {
        source: '/platform-v7/lots/new',
        destination: '/platform-v7/lots/create',
        permanent: true,
      },
      {
        source: '/lots/new',
        destination: '/platform-v7/lots/create',
        permanent: true,
      },
    ];
  },
};
module.exports = nextConfig;
