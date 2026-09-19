import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PUBLIC_INDEXABLE = [
  '/platform-v7',
  '/platform-v7/secure-grain-deal',
  '/platform-v7/grain-logistics',
  '/platform-v7/grain-quality',
  '/platform-v7/grain-documents',
  '/platform-v7/grain-payment',
  '/platform-v7/fgis-zerno',
];

const PRIVATE_NOINDEX = [
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/bank',
  '/platform-v7/operator',
];

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      marker: 'seo-live-smoke-2026-07-01',
      purpose: 'Verify that the deployed production build contains the SEO indexing fixes without exposing private cabinet data.',
      expected: {
        publicIndexableHeader: 'x-robots-tag: index, follow',
        privateCabinetHeader: 'x-robots-tag: noindex, nofollow',
      },
      publicIndexable: PUBLIC_INDEXABLE,
      privateNoindex: PRIVATE_NOINDEX,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}
