import { NextRequest } from 'next/server';
import { proxyIntegrationCommand } from '../../../_command-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const SAFE_ADAPTER_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/;
type RouteContext = { params: Promise<{ adapterCode: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { adapterCode } = await context.params;
  if (!SAFE_ADAPTER_CODE.test(adapterCode)) {
    return Response.json({ code: 'INTEGRATION_ROUTE_NOT_ALLOWED' }, { status: 404 });
  }
  return proxyIntegrationCommand(
    request,
    `/platform-v7/integrations/${encodeURIComponent(adapterCode)}/commands/reconcile`,
  );
}
