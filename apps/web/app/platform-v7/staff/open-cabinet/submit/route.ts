import { NextRequest, NextResponse } from 'next/server';
import { POST as issueCabinetSession } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = await issueCabinetSession(request);
  const location = response.headers.get('location');

  if (response.status === 303 && location) {
    const target = new URL(location, request.url);
    const failedBackToOwnerCenter = target.pathname === '/platform-v7/staff';
    if (!failedBackToOwnerCenter) {
      response.headers.set(
        'Location',
        new URL('/platform-v7/staff/cabinet-handoff', request.url).toString(),
      );
    }
  }

  return response;
}
