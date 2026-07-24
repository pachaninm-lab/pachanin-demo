import { NextRequest } from 'next/server';
import { proxyIntegrationCommand } from '../../../../_command-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;
type RouteContext = { params: Promise<{ entryId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { entryId } = await context.params;
  if (!SAFE_ID.test(entryId)) {
    return Response.json({ code: 'INTEGRATION_ROUTE_NOT_ALLOWED' }, { status: 404 });
  }
  return proxyIntegrationCommand(
    request,
    `/platform-v7/integrations/inbox/${encodeURIComponent(entryId)}/commands/redrive`,
  );
}
