import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const token = new URL(request.url).searchParams.get('token')?.trim() || '';
  if (!token.startsWith('rst_reg_') || token.length > 512) {
    return json({ ok: false, code: 'REGISTRATION_APPLICATION_NOT_FOUND', correlationId }, 404);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  if (!upstream) {
    return json({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const response = await fetch(`${upstream}/auth/registration/status?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'x-correlation-id': correlationId },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const status = response.status >= 500 ? 503 : 404;
      return json({
        ok: false,
        code: status === 503 ? 'REGISTRATION_SERVICE_UNAVAILABLE' : 'REGISTRATION_APPLICATION_NOT_FOUND',
        correlationId,
      }, status);
    }
    return json({ ok: true, ...payload, correlationId: payload.correlationId || correlationId }, 200);
  } catch (error) {
    console.error('registration_status_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
