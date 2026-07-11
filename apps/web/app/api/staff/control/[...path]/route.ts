import { NextRequest } from 'next/server';
import { proxyStaffChannel } from '@/lib/server/staff/staff-api-channel-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function route(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxyStaffChannel(request, context.params.path || [], 'control');
}

export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
