import { NextRequest } from 'next/server';
import { proxyStaffRequest } from '@/lib/server/staff/staff-api-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function route(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxyStaffRequest(request, context.params.path || []);
}

export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
