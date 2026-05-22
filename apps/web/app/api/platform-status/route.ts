import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';

export const dynamic = 'force-dynamic';

async function safeFetch(url: string, headers: Headers) {
  try {
    const res = await fetch(url, { cache: 'no-store', headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const h = runtimeAuthHeaders({ 'Content-Type': 'application/json' });

  const [deals, payments, disputes, shipments, outbox, integrations] = await Promise.all([
    safeFetch(runtimeApiUrl('/deals'), h),
    safeFetch(runtimeApiUrl('/settlement-engine/payments'), h),
    safeFetch(runtimeApiUrl('/disputes'), h),
    safeFetch(runtimeApiUrl('/logistics/shipments'), h),
    safeFetch(runtimeApiUrl('/settlement-engine/outbox'), h),
    safeFetch(runtimeApiUrl('/integrations/health'), h),
  ]);

  const apiOnline = deals !== null;

  return NextResponse.json({
    apiOnline,
    timestamp: new Date().toISOString(),
    deals: deals ?? [],
    payments: payments ?? [],
    disputes: disputes ?? [],
    shipments: shipments ?? [],
    outbox: outbox ?? { pending: [], manualReview: [] },
    integrations: integrations ?? { status: 'UNKNOWN', connectors: [] },
    summary: {
      activeDeals: Array.isArray(deals) ? deals.length : 0,
      openDisputes: Array.isArray(disputes)
        ? disputes.filter((d: any) => ['OPEN', 'UNDER_REVIEW'].includes(d.status)).length
        : 0,
      pendingBankOps: outbox?.pending?.length ?? 0,
      manualReviewOps: outbox?.manualReview?.length ?? 0,
      activeShipments: Array.isArray(shipments)
        ? shipments.filter((s: any) => ['IN_TRANSIT', 'AT_UNLOADING'].includes(s.status)).length
        : 0,
    },
  });
}
