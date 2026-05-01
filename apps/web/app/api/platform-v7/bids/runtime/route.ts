import { NextResponse } from 'next/server';
import { getBidRuntimeView, resetBidRuntimeScope } from '@/lib/platform-v7/bid-runtime-store';
import type { PlatformRole } from '@/lib/platform-v7/execution-contour';

function roleOf(value: string | null): PlatformRole {
  const allowed: PlatformRole[] = ['seller', 'buyer', 'operator', 'bank', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'investor'];
  return allowed.includes(value as PlatformRole) ? value as PlatformRole : 'seller';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scopeId = url.searchParams.get('scopeId') || 'default';
  const lotId = url.searchParams.get('lotId') || 'LOT-2403';
  const role = roleOf(url.searchParams.get('role'));
  const viewerCounterpartyId = url.searchParams.get('viewerCounterpartyId') || undefined;
  const reset = url.searchParams.get('reset') === '1';

  const view = reset
    ? resetBidRuntimeScope(scopeId)
    : getBidRuntimeView({ scopeId, lotId, role, viewerCounterpartyId });

  return NextResponse.json(view, { status: 200 });
}
