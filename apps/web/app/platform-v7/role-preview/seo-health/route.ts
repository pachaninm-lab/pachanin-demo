import { NextResponse } from 'next/server';
import {
  PLATFORM_V7_PRIVATE_ROBOTS_PREFIXES,
  PLATFORM_V7_PUBLIC_SEO_PATHS,
} from '@/lib/platform-v7/public-seo-routes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUILD_COMMIT_SHA = process.env.NEXT_PUBLIC_BUILD_COMMIT_REF?.trim() || 'unknown';

export function GET() {
  return NextResponse.json(
    {
      schemaVersion: 2,
      ok: true,
      marker: 'seo-live-smoke-v2',
      commitSha: BUILD_COMMIT_SHA,
      purpose: 'Verify that production serves the exact main commit and the canonical public/private SEO authority.',
      expected: {
        publicIndexableHeader: 'x-robots-tag contains index and follow without noindex',
        privateCabinetHeader: 'x-robots-tag contains noindex and nofollow',
      },
      publicIndexable: PLATFORM_V7_PUBLIC_SEO_PATHS,
      privateNoindex: PLATFORM_V7_PRIVATE_ROBOTS_PREFIXES,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}
