/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vermillion-kitsune-0e7b97.netlify.app';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://api-maps.yandex.ru",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://mc.yandex.ru https://api-maps.yandex.ru wss:",
      "frame-src 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; '),
  },
];

const publicEntryFreshHeaders = [
  { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
  { key: 'CDN-Cache-Control', value: 'no-store' },
  { key: 'Netlify-CDN-Cache-Control', value: 'no-store' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
];

const serviceWorkerRecoveryHeaders = [
  ...publicEntryFreshHeaders,
  { key: 'Service-Worker-Allowed', value: '/' },
];

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/',
        headers: publicEntryFreshHeaders,
      },
      {
        source: '/platform-v7',
        headers: publicEntryFreshHeaders,
      },
      {
        source: '/pc-public-entry/platform-v7',
        headers: publicEntryFreshHeaders,
      },
      {
        source: '/sw.js',
        headers: serviceWorkerRecoveryHeaders,
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/sw.js', destination: '/pc-public-entry/sw-recovery' },
        { source: '/platform-v7', destination: '/pc-public-entry/platform-v7' },
        { source: '/platform-v7/login', destination: '/pc-public-entry/platform-v7/login' },
        { source: '/platform-v7/forgot-password', destination: '/pc-public-entry/platform-v7/forgot-password' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      {
        source: '/platform-v7/demo/ai',
        destination: '/platform-v7/ai-in-action',
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
module.exports = withNextIntl(nextConfig);
